// Kids protein portion (GitHub issue #4). One `sides` plan row per day, plus a
// weekend side on Saturday and Sunday. The pools live in
// config/kids-protein.json; nothing here is tied to a database table of its own.
//
// Pool for a day:
//   1. veg-only weekday (Tue/Thu), festival, strict-veg or fasting day
//        -> veg_restricted_days (paneer, chole, soya ...)
//   2. summer months            -> summer (curd, yogurt, lassi, chhach ...)
//   3. everything else          -> default (egg)
const { loadKidsProtein } = require('./jsonRecipes');
const { SLOT, MEAL_TYPE } = require('./slots');
const { dateOffset, daysBetween, weekdayName, isWeekend } = require('./dates');

const DAY_MILLISECONDS = 86400000;
const STRICT_VEG_RESTRICTIONS = ['strict_veg', 'fasting'];

function poolNameFor(date, calendar, config) {
  const vegOnlyWeekdays = config.vegOnlyWeekdays.map((day) => day.toLowerCase());
  const restricted = vegOnlyWeekdays.includes(weekdayName(date))
    || calendar.hasFestival
    || STRICT_VEG_RESTRICTIONS.some((restriction) => calendar.restrictions.has(restriction));
  if (restricted) return 'veg_restricted_days';
  const month = Number(date.slice(5, 7));
  return config.summerMonths.includes(month) ? 'summer' : 'default';
}

// Rotates through the pool by calendar day, skipping anything used within
// `repeatDays` of this date. If everything was used recently, the one used
// longest ago wins.
function pickSide(database, date, poolEntries, mealType, repeatDays) {
  const names = poolEntries.map((entry) => entry.name);
  if (names.length === 0) return null;
  const rows = database.prepare(`
    SELECT id, name FROM recipe
    WHERE approved = 1 AND meal_type = ? AND name IN (${names.map(() => '?').join(', ')})
  `).all(mealType, ...names);
  if (rows.length === 0) return null;
  const ordered = names.map((name) => rows.find((row) => row.name === name)).filter(Boolean);

  const recent = new Map(); // recipeId -> closest planned distance in days
  database.prepare(`
    SELECT recipe_id AS recipeId, meal_date AS mealDate
    FROM weekly_meal_plan
    WHERE meal_slot = ? AND status != 'replaced' AND meal_date BETWEEN ? AND ?
  `).all(SLOT.SIDES, dateOffset(date, -repeatDays), dateOffset(date, repeatDays)).forEach((row) => {
    const distance = Math.abs(daysBetween(row.mealDate, date));
    recent.set(row.recipeId, Math.min(distance, recent.get(row.recipeId) ?? Infinity));
  });

  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MILLISECONDS);
  const start = dayNumber % ordered.length;
  const rotated = [...ordered.slice(start), ...ordered.slice(0, start)];
  const unused = rotated.find((row) => (recent.get(row.id) ?? Infinity) > repeatDays);
  if (unused) return unused;
  return rotated.reduce((best, row) => ((recent.get(row.id) ?? Infinity) > (recent.get(best.id) ?? Infinity) ? row : best));
}

const hasSideOfType = (database, date, mealType) => Boolean(database.prepare(`
  SELECT 1
  FROM weekly_meal_plan p JOIN recipe r ON r.id = p.recipe_id
  WHERE p.meal_date = ? AND p.meal_slot = ? AND r.meal_type = ? AND p.status != 'replaced'
  LIMIT 1
`).get(date, SLOT.SIDES, mealType));

// Adds the missing side rows for one date. Existing rows (manual or generated)
// are left alone. Returns [{ date, slot, recipe }] for what was created.
function planSidesForDate(database, date, calendar) {
  const config = loadKidsProtein();
  const insert = database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
    VALUES (?, ?, ?, 'planned')
  `);
  const created = [];
  const wanted = [{ mealType: MEAL_TYPE.PROTEIN_SIDE, pool: poolNameFor(date, calendar, config) }];
  if (isWeekend(date)) wanted.push({ mealType: MEAL_TYPE.WEEKEND_SIDE, pool: 'weekend_sides' });

  wanted.forEach(({ mealType, pool }) => {
    if (hasSideOfType(database, date, mealType)) return;
    const pick = pickSide(database, date, config.pools[pool] || [], mealType, config.repeatAvoidanceDays);
    if (!pick) return;
    insert.run(pick.id, date, SLOT.SIDES);
    created.push({ date, slot: SLOT.SIDES, recipe: pick.name });
  });
  return created;
}

module.exports = { planSidesForDate, poolNameFor };
