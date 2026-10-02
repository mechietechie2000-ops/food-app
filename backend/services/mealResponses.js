// One place that decides what "cooked / skipped / other" means for the plan,
// the meal log and inventory. The card buttons, the automatic past-meal
// finalizer and the catch-up screen all go through applyMealResponse so the
// three paths can never drift apart.
const { dateOffset } = require('./dates');
const { UNCONFIRMED_SLOTS, sqlList } = require('./slots');

const RESPONSE = Object.freeze({ YES: 'yes', NO: 'no', OTHER: 'other' });
const STATUS_BY_RESPONSE = Object.freeze({
  [RESPONSE.YES]: 'confirmed_cooked',
  [RESPONSE.NO]: 'confirmed_skipped',
  [RESPONSE.OTHER]: 'other',
});
const CATCHUP_CHOICE = Object.freeze({ COOKED: 'cooked', SKIPPED: 'skipped', AWAY: 'away' });
const LOG_SOURCE_MANUAL = 'manual';
const AWAY_REASON_OTHER = 'other';
const AWAY_DETECTED_MANUALLY = 'manual';
const MAX_CATCHUP_RESPONSES = 100;

// Full-item consumption (spec 6.2): flip the oldest AVAILABLE lot of every
// REQUIRED fresh item to USED. Always-available staples have no lots.
function consumeRequiredFreshItems(database, plan) {
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

  const consumed = [];
  const missingInventory = [];
  requiredFresh.forEach((item) => {
    const lot = findOldestLot.get(item.id);
    if (lot) {
      markUsed.run(plan.meal_date, lot.id);
      consumed.push({ item: item.name, inventoryId: lot.id });
    } else {
      missingInventory.push(item.name);
    }
  });
  return { consumed, missingInventory };
}

// Records one response for a plan row. Callers wrap this in a transaction.
// Returns null when the row is no longer 'planned' (already answered).
function applyMealResponse(database, plan, response, { source = LOG_SOURCE_MANUAL, notes = null } = {}) {
  const updated = database.prepare(`
    UPDATE weekly_meal_plan
    SET status = ?
    WHERE id = ? AND status = 'planned'
  `).run(STATUS_BY_RESPONSE[response], plan.id);
  if (updated.changes !== 1) return null;

  database.prepare(`
    INSERT INTO meal_confirmation_log
      (plan_id, recipe_id, cooked_date, user_response, source, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(plan.id, plan.recipe_id, plan.meal_date, response, source, notes);

  // "No" and "Other" never touch inventory (spec 6.1).
  if (response !== RESPONSE.YES) {
    return { status: response, consumed: [], missingInventory: [] };
  }
  return { status: response, ...consumeRequiredFreshItems(database, plan) };
}

// Meals still 'planned' whose date has passed, within the catch-up window.
// This feeds both the catch-up prompt (spec 6.4 step 3) and the passive
// morning digest (step 4): the app is the backstop when a push is lost.
function getUnconfirmedMeals(database, today, lookbackDays) {
  return database.prepare(`
    SELECT p.id, p.recipe_id, r.name AS recipe_name, p.meal_date, p.meal_slot,
           p.tiffin_kid_slot, p.status
    FROM weekly_meal_plan p
    JOIN recipe r ON r.id = p.recipe_id
    WHERE p.status = 'planned'
      AND p.meal_date < ?
      AND p.meal_date >= ?
      AND p.meal_slot NOT IN (${sqlList(UNCONFIRMED_SLOTS)})
    ORDER BY p.meal_date, p.meal_slot, p.id
  `).all(today, dateOffset(today, -lookbackDays), ...UNCONFIRMED_SLOTS);
}

function recordAwayDay(database, date) {
  database.prepare(`
    INSERT OR IGNORE INTO away_log (away_date, reason, detected_via, notes)
    VALUES (?, ?, ?, 'Marked away from the meal catch-up screen.')
  `).run(date, AWAY_REASON_OTHER, AWAY_DETECTED_MANUALLY);
}

function isValidCatchUpBody(responses) {
  if (!Array.isArray(responses) || responses.length === 0 || responses.length > MAX_CATCHUP_RESPONSES) {
    return false;
  }
  const choices = Object.values(CATCHUP_CHOICE);
  const planIds = responses.map((entry) => entry?.planId);
  return responses.every((entry) => Number.isSafeInteger(entry?.planId)
    && entry.planId > 0
    && choices.includes(entry.response))
    && new Set(planIds).size === planIds.length;
}

// Applies the catch-up multi-select. Same log/inventory effects as the
// card buttons: cooked -> yes (inventory used), skipped -> no, away -> no
// plus an away_log row so cooldown math ignores that day (spec 7).
function applyCatchUpResponses(database, responses) {
  const findPlan = database.prepare(`
    SELECT id, recipe_id, meal_date, meal_slot, status
    FROM weekly_meal_plan
    WHERE id = ?
  `);
  const outcome = { saved: 0, alreadyAnswered: 0, consumed: [], missingInventory: [] };

  database.transaction(() => {
    responses.forEach(({ planId, response }) => {
      const plan = findPlan.get(planId);
      if (!plan || plan.status !== 'planned') {
        outcome.alreadyAnswered += 1;
        return;
      }
      const mealResponse = response === CATCHUP_CHOICE.COOKED ? RESPONSE.YES : RESPONSE.NO;
      const result = applyMealResponse(database, plan, mealResponse, {
        notes: `Catch-up screen: ${response}.`,
      });
      if (!result) {
        outcome.alreadyAnswered += 1;
        return;
      }
      if (response === CATCHUP_CHOICE.AWAY) recordAwayDay(database, plan.meal_date);
      outcome.saved += 1;
      outcome.consumed.push(...result.consumed);
      outcome.missingInventory.push(...result.missingInventory);
    });
  })();
  return outcome;
}

module.exports = {
  RESPONSE,
  applyMealResponse,
  getUnconfirmedMeals,
  isValidCatchUpBody,
  applyCatchUpResponses,
};
