const express = require('express');

const WEEK_DAYS = 7;
const DAY_MILLISECONDS = 86400000;
const DAL_INTERVAL_DAYS = 2;
const FRESHNESS_SOON_DAYS = 2;
const MEAL_SLOTS = new Set(['kids_tiffin', 'adult_tiffin', 'dinner', 'weekend_lunch']);
const AUTO_COOK_MEAL_SLOTS = ['kids_tiffin', 'dinner', 'weekend_lunch'];

function isDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function dateOffset(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

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

function confirmCookedPlan(database, plan) {
  const updated = database.prepare(`
    UPDATE weekly_meal_plan
    SET status = 'confirmed_cooked'
    WHERE id = ? AND status = 'planned'
  `).run(plan.id);
  if (updated.changes !== 1) return;

  database.prepare(`
    INSERT INTO meal_confirmation_log
      (plan_id, recipe_id, cooked_date, user_response, source, notes)
    VALUES (?, ?, ?, 'yes', 'manual', ?)
  `).run(plan.id, plan.recipe_id, plan.meal_date, 'Assumed cooked: no skip was recorded.');

  const requiredFresh = database.prepare(`
    SELECT i.id
    FROM recipe_item ri
    JOIN item i ON i.id = ri.item_id
    WHERE ri.recipe_id = ? AND ri.role = 'REQUIRED'
      AND i.inventory_type = 'FRESH'
  `).all(plan.recipe_id);
  const findOldestLot = database.prepare(`
    SELECT id
    FROM inventory
    WHERE item_id = ? AND status = 'AVAILABLE'
    ORDER BY purchase_date, id
    LIMIT 1
  `);
  const markUsed = database.prepare(`
    UPDATE inventory SET status = 'USED', used_date = ?
    WHERE id = ? AND status = 'AVAILABLE'
  `);
  requiredFresh.forEach((item) => {
    const lot = findOldestLot.get(item.id);
    if (lot) markUsed.run(plan.meal_date, lot.id);
  });
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

  function getDashboard(weekStart) {
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
               p.meal_date, p.meal_slot, p.status
        FROM weekly_meal_plan p
        JOIN recipe r ON r.id = p.recipe_id
        WHERE p.meal_date BETWEEN ? AND ? AND p.status != 'replaced'
        ORDER BY p.meal_date, p.meal_slot, p.id
      `).all(weekStart, weekEnd),
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
    return res.json(getDashboard(weekStart));
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
      if (AUTO_COOK_MEAL_SLOTS.includes(plan.meal_slot) && response !== 'no') {
        return null;
      }

      const updated = database.prepare(`
        UPDATE weekly_meal_plan
        SET status = ?
        WHERE id = ? AND status = 'planned'
      `).run(response === 'yes' ? 'confirmed_cooked' : response === 'no' ? 'confirmed_skipped' : 'other', planId);
      if (updated.changes !== 1) return null;

      database.prepare(`
        INSERT INTO meal_confirmation_log (plan_id, recipe_id, cooked_date, user_response, source)
        VALUES (?, ?, ?, ?, 'manual')
      `).run(plan.id, plan.recipe_id, plan.meal_date, response);

      const consumed = [];
      const missingInventory = [];
      if (response === 'yes') {
        const requiredFresh = database.prepare(`
          SELECT i.id, i.name
          FROM recipe_item ri
          JOIN item i ON i.id = ri.item_id
          WHERE ri.recipe_id = ? AND ri.role = 'REQUIRED'
            AND i.inventory_type = 'FRESH'
          ORDER BY i.id
        `).all(plan.recipe_id);
        const findOldestLot = database.prepare(`
          SELECT id
          FROM inventory
          WHERE item_id = ? AND status = 'AVAILABLE'
          ORDER BY purchase_date, id
          LIMIT 1
        `);
        const markUsed = database.prepare(`
          UPDATE inventory SET status = 'USED', used_date = ?
          WHERE id = ? AND status = 'AVAILABLE'
        `);
        requiredFresh.forEach((item) => {
          const lot = findOldestLot.get(item.id);
          if (lot) {
            markUsed.run(plan.meal_date, lot.id);
            consumed.push({ item: item.name, inventoryId: lot.id });
          } else {
            missingInventory.push(item.name);
          }
        });
      }
      return { status: response, consumed, missingInventory };
    });

    const result = confirmMeal();
    if (!result) {
      return res.status(409).json({ error: 'This meal is no longer awaiting confirmation or cannot be manually confirmed.' });
    }
    return res.json(result);
  });

  return router;
}

module.exports = createFoodRouter;
