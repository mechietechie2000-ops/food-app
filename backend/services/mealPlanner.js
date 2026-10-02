// Meal decision pipeline (spec Section 4/4a) and weekly plan publishing
// (spec Section 5).
//
//   decideMeal()   ranks the eligible recipes for ONE date + meal slot.
//   generateWeek() calls decideMeal() for every slot of a week and writes the
//                  winners into weekly_meal_plan with status = 'planned'.
//
// The UI cards read weekly_meal_plan, never this module, so a published plan
// stays stable until something explicitly changes it.
const { rules } = require('./rules');
const { SLOT, NON_MAIN_MEAL_TYPES, sqlList } = require('./slots');
const { planSidesForDate } = require('./kidsSides');
const {
  WEEK_DAYS,
  dateOffset,
  daysBetween,
  weekdayName,
  weekdayIndex,
  isWeekend,
  localDateString,
} = require('./dates');

const TIFFIN_TYPE = Object.freeze({
  KIDS: 'kids_tiffin',
  ADULT: 'adult_tiffin',
  NONE: 'none',
});
const DIETARY = Object.freeze({
  STRICT_VEG: 'strict_veg',
  NO_ONION_GARLIC: 'no_onion_garlic',
  FASTING: 'fasting',
  NONE: 'none',
});
const KIDS_TIFFIN_PARTS = ['AM', 'PM'];
const INDIAN_CUISINE = 'Indian';       // adult tiffin must NOT be Indian (spec 4a)
const NO_EXPIRY_DAYS = 9999;           // sorts lots without an expiry date last
// Slots where festival menus and the weekend non-veg/frozen preference apply.
// Tiffin has its own strict rules, so festivals do not steer it.
const HOME_MEAL_SLOTS = new Set([SLOT.DINNER, SLOT.WEEKEND_LUNCH]);
// Most-restricted slots choose first so they are not starved of ingredients.
const SLOT_ORDER = [SLOT.KIDS_TIFFIN, SLOT.ADULT_TIFFIN, SLOT.WEEKEND_LUNCH, SLOT.DINNER];
const WEEKEND_RANK = Object.freeze({ NON_VEG: 0, FROZEN_FRIENDLY: 1, OTHER: 2 });

// ---------------------------------------------------------------------------
// Planning context: everything decideMeal() needs, loaded once per run.
// ---------------------------------------------------------------------------

function groupBy(rows, keyOf) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}

function loadPlanningContext(database) {
  const recipes = database.prepare(`
    SELECT id, name, cuisine, meal_type, is_veg, is_frozen_friendly, cooldown_days,
           suitable_for_kids_tiffin, suitable_for_adult_tiffin, suitable_for_adult_dinner
    FROM recipe
    WHERE approved = 1 AND COALESCE(meal_type, '') NOT IN (${sqlList(NON_MAIN_MEAL_TYPES)})
    ORDER BY name
  `).all(...NON_MAIN_MEAL_TYPES); // dal sides, breakfast and kids sides are planned separately

  const itemsByRecipe = groupBy(database.prepare(`
    SELECT ri.recipe_id AS recipeId, ri.role, i.id AS itemId, i.name,
           i.inventory_type AS inventoryType, i.always_available AS alwaysAvailable
    FROM recipe_item ri
    JOIN item i ON i.id = ri.item_id
  `).all(), (row) => row.recipeId);

  // Every purchase stays its own lot; the oldest lot is always used first,
  // exactly like the confirmation flow does when a meal is marked cooked.
  const lotsByItem = groupBy(database.prepare(`
    SELECT id, item_id AS itemId, purchase_date AS purchaseDate, expiry_date AS expiryDate
    FROM inventory
    WHERE status = 'AVAILABLE'
    ORDER BY purchase_date, id
  `).all(), (row) => row.itemId);

  const cookedDatesByRecipe = new Map();
  database.prepare(`
    SELECT recipe_id AS recipeId, cooked_date AS cookedDate
    FROM meal_confirmation_log
    WHERE user_response = 'yes'
  `).all().forEach(({ recipeId, cookedDate }) => {
    if (!cookedDatesByRecipe.has(recipeId)) cookedDatesByRecipe.set(recipeId, []);
    cookedDatesByRecipe.get(recipeId).push(cookedDate);
  });

  const awayDates = new Set(database.prepare('SELECT away_date AS awayDate FROM away_log').all()
    .map((row) => row.awayDate));

  const context = {
    database,
    recipes,
    itemsByRecipe,
    lotsByItem,
    cookedDatesByRecipe,
    awayDates,
    allocatedByItem: new Map(),   // itemId -> lots already promised to a plan row
    plannedDatesByRecipe: new Map(),
    noOnionGarlicNames: new Set(rules.no_onion_garlic_item_names.map((name) => name.toLowerCase())),
  };

  // Rows that are still 'planned' (even past ones nobody has answered yet)
  // will use lots when they are cooked, so those lots are already spoken for.
  database.prepare(`
    SELECT recipe_id AS recipeId, meal_date AS mealDate
    FROM weekly_meal_plan
    WHERE status = 'planned'
  `).all().forEach(({ recipeId, mealDate }) => {
    reservePlannedRecipe(context, recipeId, mealDate, requiredFreshItems(context, recipeId));
  });
  return context;
}

function requiredFreshItems(context, recipeId) {
  return (context.itemsByRecipe.get(recipeId) || [])
    .filter((item) => item.role === 'REQUIRED' && item.inventoryType === 'FRESH');
}

function reservePlannedRecipe(context, recipeId, date, freshItems) {
  freshItems.forEach((item) => {
    context.allocatedByItem.set(item.itemId, (context.allocatedByItem.get(item.itemId) || 0) + 1);
  });
  if (!context.plannedDatesByRecipe.has(recipeId)) context.plannedDatesByRecipe.set(recipeId, []);
  context.plannedDatesByRecipe.get(recipeId).push(date);
}

// ---------------------------------------------------------------------------
// Tiffin schedule (spec 4a): one-off override > weekday default > 'none'.
// ---------------------------------------------------------------------------

function resolveTiffinType(database, date) {
  const override = database.prepare(
    'SELECT tiffin_type AS tiffinType FROM tiffin_schedule WHERE effective_date = ?',
  ).get(date);
  if (override) return override.tiffinType;

  const standing = database.prepare(`
    SELECT tiffin_type AS tiffinType
    FROM tiffin_schedule
    WHERE day_of_week = ? AND effective_date IS NULL
  `).get(weekdayName(date));
  return standing ? standing.tiffinType : TIFFIN_TYPE.NONE;
}

// Cycle day is derived from the weekday at write time: Monday = 1,
// Tuesday = 2, Wednesday = 1, and so on.
function adultTiffinCycleDay(date) {
  return weekdayIndex(date) % 2 === 1 ? 1 : 2;
}

// ---------------------------------------------------------------------------
// decideMeal() building blocks
// ---------------------------------------------------------------------------

// Counts calendar days between a past date and the target date, skipping
// away days, so a vacation does not "use up" the cooldown (spec Section 7).
function isWithinWindow(context, pastDate, targetDate, windowDays) {
  const rawDays = daysBetween(pastDate, targetDate);
  if (rawDays <= 0) return true;
  if (rawDays > windowDays + context.awayDates.size) return false;
  let countedDays = 0;
  for (let offset = 1; offset <= rawDays; offset += 1) {
    if (!context.awayDates.has(dateOffset(pastDate, offset))) countedDays += 1;
  }
  return countedDays < windowDays;
}

function wasCookedWithin(context, recipeId, date, windowDays) {
  return (context.cookedDatesByRecipe.get(recipeId) || [])
    .some((cookedDate) => isWithinWindow(context, cookedDate, date, windowDays));
}

function wasPlannedNear(context, recipeId, date, windowDays) {
  return (context.plannedDatesByRecipe.get(recipeId) || [])
    .some((plannedDate) => Math.abs(daysBetween(plannedDate, date)) < windowDays);
}

// Step 1: every REQUIRED ingredient must be present. Returns the fresh lots
// this recipe would consume (oldest unclaimed lot per item) or null.
function findFreshLots(context, recipe) {
  const required = (context.itemsByRecipe.get(recipe.id) || []).filter((item) => item.role === 'REQUIRED');
  const freshLots = [];
  const isMissing = required.some((item) => {
    if (item.alwaysAvailable) return false;
    const lots = context.lotsByItem.get(item.itemId) || [];
    const claimed = context.allocatedByItem.get(item.itemId) || 0;
    if (claimed >= lots.length) return true;
    if (item.inventoryType === 'FRESH') freshLots.push({ item, lot: lots[claimed] });
    return false;
  });
  // A recipe with no fresh required item is not driven by inventory, so the
  // planner leaves it to manual planning (same rule as the recommendations).
  return isMissing || freshLots.length === 0 ? null : freshLots;
}

// Step 3: what the calendar says about this date.
function getCalendarInfo(database, date) {
  const rows = database.prepare(`
    SELECT festival_id AS festivalId, dietary_restriction AS dietaryRestriction
    FROM calendar_date
    WHERE calendar_date = ?
  `).all(date);
  const festivalIds = rows.map((row) => row.festivalId).filter((id) => id !== null);
  const festivalRecipes = new Map(); // recipeId -> family_preference (0/1)
  if (festivalIds.length > 0) {
    database.prepare(`
      SELECT fr.recipe_id AS recipeId, fr.family_preference AS familyPreference
      FROM festival_recipe fr
      JOIN festival f ON f.id = fr.festival_id
      WHERE f.active = 1 AND fr.festival_id IN (${festivalIds.map(() => '?').join(', ')})
    `).all(...festivalIds).forEach(({ recipeId, familyPreference }) => {
      festivalRecipes.set(recipeId, Math.max(familyPreference, festivalRecipes.get(recipeId) || 0));
    });
  }
  return {
    hasFestival: festivalIds.length > 0,
    restrictions: new Set(rows.map((row) => row.dietaryRestriction).filter((value) => value !== DIETARY.NONE)),
    festivalRecipes,
  };
}

function passesDietaryRestrictions(context, recipe, restrictions) {
  const needsVeg = restrictions.has(DIETARY.STRICT_VEG) || restrictions.has(DIETARY.FASTING);
  if (needsVeg && !recipe.is_veg) return false;
  const skipsOnionGarlic = restrictions.has(DIETARY.NO_ONION_GARLIC) || restrictions.has(DIETARY.FASTING);
  if (!skipsOnionGarlic) return true;
  return !(context.itemsByRecipe.get(recipe.id) || [])
    .some((item) => context.noOnionGarlicNames.has(item.name.toLowerCase()));
}

// Step 6 placeholder: guest handling is not built yet, so this is a no-op
// that keeps the pipeline position reserved for when it is.
function checkGuestCalendar() {
  return { guestCount: 0 };
}

// Step 7: meal-slot rules. Lunch has no suitability flag, so any approved
// non-dal-side recipe qualifies (same as the manual planner).
function matchesSlot(recipe, slot) {
  if (slot === SLOT.KIDS_TIFFIN) return Boolean(recipe.suitable_for_kids_tiffin);
  if (slot === SLOT.ADULT_TIFFIN) {
    return Boolean(recipe.suitable_for_adult_tiffin) && recipe.cuisine !== INDIAN_CUISINE;
  }
  if (slot === SLOT.DINNER) return Boolean(recipe.suitable_for_adult_dinner);
  return true;
}

function weekendRank(recipe) {
  if (!recipe.is_veg) return WEEKEND_RANK.NON_VEG;
  return recipe.is_frozen_friendly ? WEEKEND_RANK.FROZEN_FRIENDLY : WEEKEND_RANK.OTHER;
}

// ---------------------------------------------------------------------------
// decideMeal(): the ordered pipeline for one date + slot.
// Returns eligible candidates, best first (the caller uses the top one, or
// shows the top N for a person to choose from).
// ---------------------------------------------------------------------------
function decideMeal(context, { date, slot }) {
  const calendar = getCalendarInfo(context.database, date);
  checkGuestCalendar(context.database, date); // step 6 (stub)

  let candidates = context.recipes.flatMap((recipe) => {
    // Step 1: required ingredients present and AVAILABLE.
    const freshLots = findFreshLots(context, recipe);
    if (!freshLots) return [];
    // Step 2: cooldown (only 'yes' log rows count; away days are skipped).
    const cooldownDays = recipe.cooldown_days ?? rules.default_cooldown_days;
    if (wasCookedWithin(context, recipe.id, date, cooldownDays)) return [];
    // Step 3 (dietary part): fasting / strict veg / no onion-garlic days.
    if (!passesDietaryRestrictions(context, recipe, calendar.restrictions)) return [];
    // Step 7: slot rules (kids / adult tiffin / dinner).
    if (!matchesSlot(recipe, slot)) return [];
    // Step 8: avoid recent repeats, both cooked and already planned.
    const repeatWindowDays = Math.max(cooldownDays, rules.repeat_avoidance_lookback_days);
    if (wasCookedWithin(context, recipe.id, date, rules.repeat_avoidance_lookback_days)
      || wasPlannedNear(context, recipe.id, date, repeatWindowDays)) return [];

    // Step 9 input: days until the soonest-expiring lot this recipe would use.
    const soonestExpiryDays = Math.min(...freshLots.map(({ lot }) => (
      lot.expiryDate ? daysBetween(date, lot.expiryDate) : NO_EXPIRY_DAYS
    )));
    return [{
      recipe,
      freshLots,
      soonestExpiryDays,
      festivalPreference: calendar.festivalRecipes.get(recipe.id),
    }];
  });

  // Step 3 (festival part): on a festival, restrict to that festival's
  // recipes first. If none of them can be made, fall back to everything.
  const usesFestivalMenu = HOME_MEAL_SLOTS.has(slot) && calendar.festivalRecipes.size > 0;
  if (usesFestivalMenu) {
    const festivalCandidates = candidates.filter((entry) => entry.festivalPreference !== undefined);
    if (festivalCandidates.length > 0) candidates = festivalCandidates;
  }

  // Step 4: weekend with no festival prefers non-veg, then frozen-friendly.
  const prefersWeekendDishes = HOME_MEAL_SLOTS.has(slot) && isWeekend(date) && !calendar.hasFestival;

  // Steps 4 and 9: preferences first, then soonest-expiring produce first.
  return candidates.sort((first, second) => (
    (second.festivalPreference ?? -1) - (first.festivalPreference ?? -1)
    || (prefersWeekendDishes ? weekendRank(first.recipe) - weekendRank(second.recipe) : 0)
    || first.soonestExpiryDays - second.soonestExpiryDays
    || first.recipe.name.localeCompare(second.recipe.name)
  ));
}

// ---------------------------------------------------------------------------
// Weekly publishing
// ---------------------------------------------------------------------------

// The slots that exist on a date: tiffin per tiffin_schedule, weekend lunch
// on Sat/Sun, dinner every day.
function slotsForDate(database, date) {
  const tiffinType = resolveTiffinType(database, date);
  const slots = [];
  if (tiffinType === TIFFIN_TYPE.KIDS) slots.push({ slot: SLOT.KIDS_TIFFIN, kidParts: KIDS_TIFFIN_PARTS });
  if (tiffinType === TIFFIN_TYPE.ADULT) slots.push({ slot: SLOT.ADULT_TIFFIN, kidParts: [null] });
  if (isWeekend(date)) slots.push({ slot: SLOT.WEEKEND_LUNCH, kidParts: [null] });
  slots.push({ slot: SLOT.DINNER, kidParts: [null] });
  return slots.sort((first, second) => SLOT_ORDER.indexOf(first.slot) - SLOT_ORDER.indexOf(second.slot));
}

// Fills the empty slots of one Monday-to-Sunday week. Safe to run again:
// a slot that already has a plan row (manual or generated) is left alone, and
// dates before `today` are never touched.
function generateWeek(database, weekStart, { today = localDateString(new Date()) } = {}) {
  const context = loadPlanningContext(database);
  const summary = { weekStart, created: 0, alreadyPlanned: 0, unfilled: [], plan: [] };
  const hasPlanRow = database.prepare(`
    SELECT 1 FROM weekly_meal_plan
    WHERE meal_date = ? AND meal_slot = ? AND status != 'replaced'
    LIMIT 1
  `);
  const insertPlanRow = database.prepare(`
    INSERT INTO weekly_meal_plan
      (recipe_id, meal_date, meal_slot, tiffin_kid_slot, tiffin_adult_cycle_day, status)
    VALUES (?, ?, ?, ?, ?, 'planned')
  `);

  database.transaction(() => {
    for (let offset = 0; offset < WEEK_DAYS; offset += 1) {
      const date = dateOffset(weekStart, offset);
      if (date < today) continue;

      // Kids protein side (issue #4): no inventory, no confirmation.
      planSidesForDate(database, date, getCalendarInfo(database, date)).forEach((side) => {
        summary.created += 1;
        summary.plan.push({ ...side, kidPart: null });
      });

      slotsForDate(database, date).forEach(({ slot, kidParts }) => {
        if (hasPlanRow.get(date, slot)) {
          summary.alreadyPlanned += 1;
          return;
        }
        kidParts.forEach((kidPart) => {
          // Each pick is reserved before the next call, so the PM tiffin can
          // never repeat the AM one and one lot is never promised twice.
          const [best] = decideMeal(context, { date, slot });
          if (!best) {
            summary.unfilled.push({ date, slot, kidPart });
            return;
          }
          insertPlanRow.run(
            best.recipe.id,
            date,
            slot,
            kidPart,
            slot === SLOT.ADULT_TIFFIN ? adultTiffinCycleDay(date) : null,
          );
          reservePlannedRecipe(context, best.recipe.id, date, best.freshLots.map(({ item }) => item));
          summary.created += 1;
          summary.plan.push({ date, slot, kidPart, recipe: best.recipe.name });
        });
      });
    }
  })();
  return summary;
}

module.exports = {
  SLOT,
  loadPlanningContext,
  resolveTiffinType,
  decideMeal,
  generateWeek,
};
