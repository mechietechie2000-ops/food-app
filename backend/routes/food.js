const express = require('express');
const { rules } = require('../services/rules');
const { isDate, dateOffset, isMonday, localDateString } = require('../services/dates');
const { generateWeek } = require('../services/mealPlanner');
const {
  RESPONSE,
  applyMealResponse,
  getUnconfirmedMeals,
  isValidCatchUpBody,
  applyCatchUpResponses,
} = require('../services/mealResponses');

const WEEK_DAYS = 7;
const DAY_MILLISECONDS = 86400000;
const DAL_INTERVAL_DAYS = 2;
const FRESHNESS_SOON_DAYS = 2;
const MEAL_SLOTS = new Set(['kids_tiffin', 'adult_tiffin', 'dinner', 'weekend_lunch']);
const AUTO_COOK_MEAL_SLOTS = ['kids_tiffin', 'dinner', 'weekend_lunch'];
const INVENTORY_STATUS_FILTERS = new Set(['AVAILABLE', 'USED', 'DISCARDED', 'ALL']);
const INVENTORY_ROW_LIMIT = 500;

function integerList(values) {
  return Array.isArray(values)
    && values.length > 0
    && values.every((value) => Number.isSafeInteger(value) && value > 0)
    && new Set(values).size === values.length;
}

function getDalSuggestions(database, weekStart) {
  const dalSides = database.prepare(`
    SELECT id, name
    FROM recipe
    WHERE approved = 1 AND meal_type = 'dal_side'
    ORDER BY id
  `).all();
  if (dalSides.length === 0) return [];

  const firstDay = Math.floor(Date.parse(`${weekStart}T00:00:00Z`) / DAY_MILLISECONDS);
  return Array.from({ length: WEEK_DAYS }, (_, offset) => firstDay + offset)
    .filter((day) => day % DAL_INTERVAL_DAYS === 0)
    .map((day) => {
      const date = dateOffset(weekStart, day - firstDay);
      const dalIndex = Math.floor(day / DAL_INTERVAL_DAYS) % dalSides.length;
      return {
        mealDate: date,
        recipeId: dalSides[dalIndex].id,
        name: dalSides[dalIndex].name,
      };
    });
}

// A past kids-tiffin / lunch / dinner row nobody marked Skipped is assumed
// cooked (see README). Uses the same path as the buttons so inventory and the
// meal log always agree.
function confirmCookedPlan(database, plan) {
  applyMealResponse(database, plan, RESPONSE.YES, { notes: 'Assumed cooked: no skip was recorded.' });
}

function finalizePastMeals(database, today) {
  const confirmPastMeals = database.transaction(() => {
    const pendingPlans = database.prepare(`
      SELECT id, recipe_id, meal_date
      FROM weekly_meal_plan
      WHERE status = 'planned'
        AND meal_date < ?
        AND meal_slot IN (${AUTO_COOK_MEAL_SLOTS.map(() => '?').join(', ')})
      ORDER BY meal_date, id
    `).all(today, ...AUTO_COOK_MEAL_SLOTS);
    pendingPlans.forEach((plan) => confirmCookedPlan(database, plan));
  });
  confirmPastMeals();
}

function createFoodRouter(database) {
  const router = express.Router();

  function getRecommendations() {
    const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const recipes = database.prepare(`
      SELECT r.*
      FROM recipe r
      WHERE r.approved = 1
        AND NOT EXISTS (
          SELECT 1
          FROM meal_confirmation_log log
          WHERE log.recipe_id = r.id
            AND log.user_response = 'yes'
            AND log.cooked_date >= date('now', '-' || r.cooldown_days || ' days')
            AND NOT EXISTS (
              SELECT 1 FROM away_log away WHERE away.away_date = log.cooked_date
            )
        )
      ORDER BY r.name
    `).all();

    const recipeItems = database.prepare(`
      SELECT i.id, i.name, i.inventory_type, i.always_available, ri.role
      FROM recipe_item ri
      JOIN item i ON i.id = ri.item_id
      WHERE ri.recipe_id = ?
      ORDER BY CASE ri.role WHEN 'REQUIRED' THEN 0 ELSE 1 END, i.name
    `);
    const availableLots = database.prepare(`
      SELECT id, purchase_date, expiry_date, store
      FROM inventory
      WHERE item_id = ? AND status = 'AVAILABLE'
      ORDER BY purchase_date, id
    `);

    return recipes.flatMap((recipe) => {
      const ingredients = recipeItems.all(recipe.id);
      const required = ingredients.filter((ingredient) => ingredient.role === 'REQUIRED');
      const freshRequired = required.filter((ingredient) => ingredient.inventory_type === 'FRESH');
      const selectedLots = [];
      const missing = required.some((ingredient) => {
        if (ingredient.always_available) return false;
        const lots = availableLots.all(ingredient.id);
        if (lots.length === 0) return true;
        if (ingredient.inventory_type === 'FRESH') {
          selectedLots.push({ ...ingredient, lot: lots[0] });
        }
        return false;
      });

      if (missing || freshRequired.length === 0) return [];

      const optional = ingredients
        .filter((ingredient) => ingredient.role === 'OPTIONAL')
        .filter((ingredient) => ingredient.always_available || availableLots.all(ingredient.id).length > 0)
        .map((ingredient) => ingredient.name);
      const freshness = selectedLots.map(({ id, name, lot }) => {
        const daysUntilExpiry = Math.floor(
          (Date.parse(`${lot.expiry_date}T00:00:00Z`) - today) / 86400000,
        );
        return {
          itemId: id,
          name,
          purchaseDate: lot.purchase_date,
          store: lot.store,
          lotId: lot.id,
          daysUntilExpiry,
          freshness: daysUntilExpiry < 0
            ? 'Old'
            : daysUntilExpiry <= FRESHNESS_SOON_DAYS ? 'Use soon' : 'Fresh',
        };
      });
      const soonestExpiry = Math.min(...freshness.map((entry) => entry.daysUntilExpiry));
      return [{
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        cuisine: recipe.cuisine,
        mealType: recipe.meal_type,
        suitableForKidsTiffin: Boolean(recipe.suitable_for_kids_tiffin),
        suitableForAdultTiffin: Boolean(recipe.suitable_for_adult_tiffin),
        suitableForAdultDinner: Boolean(recipe.suitable_for_adult_dinner),
        requiredFresh: freshness,
        optionalAvailable: optional,
        rankDaysUntilExpiry: soonestExpiry,
      }];
    }).sort((first, second) => first.rankDaysUntilExpiry - second.rankDaysUntilExpiry
      || first.name.localeCompare(second.name));
  }

  function getDashboard(weekStart, today) {
    const weekEnd = dateOffset(weekStart, WEEK_DAYS - 1);
    return {
      weekStart,
      weekEnd,
      items: database.prepare(`
        SELECT id, name, category, inventory_type, default_shelf_life_days, always_available
        FROM item
        WHERE active = 1 AND inventory_type = 'FRESH'
        ORDER BY name
      `).all(),
      inventory: database.prepare(`
        SELECT inv.id, inv.item_id, i.name AS item_name, inv.purchase_date,
               inv.expiry_date, inv.store, inv.status
        FROM inventory inv
        JOIN item i ON i.id = inv.item_id
        WHERE inv.status = 'AVAILABLE'
        ORDER BY inv.purchase_date, inv.id
      `).all(),
      groceryStage: database.prepare(`
        SELECT gs.id, gs.item_id, i.name AS item_name, gs.requested_at
        FROM grocery_stage gs
        JOIN item i ON i.id = gs.item_id
        WHERE gs.is_purchased = 0
        ORDER BY gs.requested_at, gs.id
      `).all(),
      recipes: database.prepare(`
        SELECT id, name, description, meal_type, cuisine,
               suitable_for_kids_tiffin, suitable_for_adult_tiffin,
               suitable_for_adult_dinner
        FROM recipe
        WHERE approved = 1
        ORDER BY name
      `).all(),
      recommendations: getRecommendations(),
      dalSuggestions: getDalSuggestions(database, weekStart),
      plan: database.prepare(`
        SELECT p.id, p.recipe_id, r.name AS recipe_name, r.description, r.meal_type,
               p.meal_date, p.meal_slot, p.tiffin_kid_slot, p.status
        FROM weekly_meal_plan p
        JOIN recipe r ON r.id = p.recipe_id
        WHERE p.meal_date BETWEEN ? AND ? AND p.status != 'replaced'
        ORDER BY p.meal_date, p.meal_slot, p.id
      `).all(weekStart, weekEnd),
      // Past meals nobody has answered yet (catch-up + morning digest).
      catchupLookbackDays: rules.catchup_lookback_days,
      unconfirmed: getUnconfirmedMeals(database, today, rules.catchup_lookback_days),
    };
  }

  function eligibleRecipe(recipeId, mealSlot) {
    const recipe = database.prepare(`
      SELECT id, meal_type, suitable_for_kids_tiffin, suitable_for_adult_tiffin,
             suitable_for_adult_dinner
      FROM recipe
      WHERE id = ? AND approved = 1
    `).get(recipeId);
    if (!recipe) return false;
    if (recipe.meal_type === 'dal_side') {
      return mealSlot === 'dinner' && Boolean(recipe.suitable_for_adult_dinner);
    }
    if (mealSlot === 'kids_tiffin' && !recipe.suitable_for_kids_tiffin) return false;
    if (mealSlot === 'adult_tiffin' && !recipe.suitable_for_adult_tiffin) return false;
    if (mealSlot === 'dinner' && !recipe.suitable_for_adult_dinner) return false;
    return getRecommendations().some((recommendation) => recommendation.id === recipeId);
  }

  router.get('/', (req, res) => {
    const weekStart = req.query.weekStart;
    const today = req.query.today;
    if (!isDate(weekStart) || !isDate(today)) {
      return res.status(400).json({ error: 'A valid weekStart date is required.' });
    }
    finalizePastMeals(database, today);
    return res.json(getDashboard(weekStart, today));
  });

  router.post('/groceries/stage', (req, res) => {
    const { itemIds } = req.body;
    if (!integerList(itemIds)) {
      return res.status(400).json({ error: 'Select one or more fresh vegetables.' });
    }

    const freshIds = new Set(database.prepare(`
      SELECT id FROM item
      WHERE active = 1 AND inventory_type = 'FRESH'
    `).all().map((item) => item.id));
    if (itemIds.some((id) => !freshIds.has(id))) {
      return res.status(400).json({ error: 'Only tracked fresh vegetables can be added to a grocery list.' });
    }

    const addItems = database.transaction((ids) => {
      const insert = database.prepare(
        "INSERT INTO grocery_stage (item_id, source) VALUES (?, 'form')",
      );
      ids.forEach((id) => insert.run(id));
    });
    addItems(itemIds);
    return res.status(201).json({ staged: itemIds.length });
  });

  router.post('/groceries/confirm', (req, res) => {
    const { stageIds, purchaseDate, store } = req.body;
    const confirmedDate = purchaseDate || new Date().toISOString().slice(0, 10);
    if (!integerList(stageIds) || !isDate(confirmedDate)) {
      return res.status(400).json({ error: 'Select pending grocery items and provide a valid purchase date.' });
    }
    if (confirmedDate > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Purchase date cannot be in the future.' });
    }
    if (store !== undefined && (typeof store !== 'string' || store.trim().length > 120)) {
      return res.status(400).json({ error: 'Store name must be 120 characters or fewer.' });
    }

    const pendingRows = database.prepare(`
      SELECT gs.id, i.id AS item_id, i.default_shelf_life_days
      FROM grocery_stage gs
      JOIN item i ON i.id = gs.item_id
      WHERE gs.is_purchased = 0 AND gs.id IN (${stageIds.map(() => '?').join(', ')})
    `).all(...stageIds);
    if (pendingRows.length !== stageIds.length) {
      return res.status(409).json({ error: 'One or more selected grocery items are no longer pending.' });
    }

    const confirmPurchases = database.transaction((rows) => {
      const insertLot = database.prepare(`
        INSERT INTO inventory (item_id, purchase_date, expiry_date, store, status)
        VALUES (?, ?, date(?, '+' || ? || ' days'), ?, 'AVAILABLE')
      `);
      const markPurchased = database.prepare(`
        UPDATE grocery_stage
        SET is_purchased = 1, confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_purchased = 0
      `);
      rows.forEach((row) => {
        insertLot.run(row.item_id, confirmedDate, confirmedDate, row.default_shelf_life_days, store?.trim() || null);
        markPurchased.run(row.id);
      });
    });
    confirmPurchases(pendingRows);
    return res.status(201).json({ purchased: pendingRows.length });
  });

  router.post('/plan', (req, res) => {
    const { recipeId, mealDate, mealSlot } = req.body;
    if (!Number.isSafeInteger(recipeId) || recipeId < 1 || !isDate(mealDate) || !MEAL_SLOTS.has(mealSlot)) {
      return res.status(400).json({ error: 'Choose an approved recipe, date, and meal slot.' });
    }
    if (mealSlot === 'weekend_lunch') {
      const weekday = new Date(`${mealDate}T00:00:00Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        return res.status(400).json({ error: 'Weekend lunch can only be planned for Saturday or Sunday.' });
      }
    }
    if (!eligibleRecipe(recipeId, mealSlot)) {
      return res.status(409).json({ error: 'That approved recipe is not currently available from fresh inventory for this meal.' });
    }

    const result = database.prepare(`
      INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
      VALUES (?, ?, ?, 'planned')
    `).run(recipeId, mealDate, mealSlot);
    return res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  router.post('/plan/:id/confirm', (req, res) => {
    const planId = Number(req.params.id);
    const { response } = req.body;
    if (!Number.isSafeInteger(planId) || planId < 1 || !['yes', 'no', 'other'].includes(response)) {
      return res.status(400).json({ error: 'A valid plan and response are required.' });
    }

    const confirmMeal = database.transaction(() => {
      const plan = database.prepare(`
        SELECT id, recipe_id, meal_date, meal_slot, status
        FROM weekly_meal_plan
        WHERE id = ?
      `).get(planId);
      if (!plan || plan.status !== 'planned') {
        return null;
      }
      if (AUTO_COOK_MEAL_SLOTS.includes(plan.meal_slot) && response !== RESPONSE.NO) {
        return null;
      }
      return applyMealResponse(database, plan, response);
    });

    const result = confirmMeal();
    if (!result) {
      return res.status(409).json({ error: 'This meal is no longer awaiting confirmation or cannot be manually confirmed.' });
    }
    return res.json(result);
  });

  // Publishes (or tops up) a week's plan on demand. The weekly scheduler runs
  // the same function; existing plan rows are never overwritten.
  router.post('/plan/generate', (req, res) => {
    const { weekStart } = req.body;
    const today = isDate(req.body.today) ? req.body.today : localDateString(new Date());
    if (!isDate(weekStart) || !isMonday(weekStart)) {
      return res.status(400).json({ error: 'weekStart must be the Monday of the week to plan.' });
    }
    return res.status(201).json(generateWeek(database, weekStart, { today }));
  });

  // Catch-up screen (spec 6.4 step 3): answer several past meals at once.
  router.post('/catchup', (req, res) => {
    const { responses } = req.body;
    if (!isValidCatchUpBody(responses)) {
      return res.status(400).json({ error: 'Choose cooked, skipped or away for one or more meals.' });
    }
    return res.json(applyCatchUpResponses(database, responses));
  });

  // Rows of the inventory table with a freshness label for available lots.
  router.get('/inventory', (req, res) => {
    const status = req.query.status === undefined ? 'AVAILABLE' : String(req.query.status).toUpperCase();
    if (!INVENTORY_STATUS_FILTERS.has(status)) {
      return res.status(400).json({ error: 'Status must be AVAILABLE, USED, DISCARDED or ALL.' });
    }
    const today = isDate(req.query.today) ? req.query.today : localDateString(new Date());
    const lots = database.prepare(`
      SELECT inv.id, inv.item_id, i.name AS item_name, i.category, inv.purchase_date,
             inv.expiry_date, inv.store, inv.status, inv.used_date
      FROM inventory inv
      JOIN item i ON i.id = inv.item_id
      WHERE (? = 'ALL' OR inv.status = ?)
      ORDER BY CASE inv.status WHEN 'AVAILABLE' THEN 0 ELSE 1 END,
               inv.expiry_date, inv.purchase_date, inv.id
      LIMIT ?
    `).all(status, status, INVENTORY_ROW_LIMIT).map((lot) => {
      if (lot.status !== 'AVAILABLE' || !lot.expiry_date) return { ...lot, days_until_expiry: null, freshness: null };
      const daysUntilExpiry = Math.round(
        (Date.parse(`${lot.expiry_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MILLISECONDS,
      );
      return {
        ...lot,
        days_until_expiry: daysUntilExpiry,
        freshness: daysUntilExpiry < 0 ? 'Old' : daysUntilExpiry <= FRESHNESS_SOON_DAYS ? 'Use soon' : 'Fresh',
      };
    });
    return res.json({ status, today, lots });
  });

  return router;
}

module.exports = createFoodRouter;
