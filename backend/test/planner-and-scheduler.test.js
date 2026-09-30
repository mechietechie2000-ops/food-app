// Run with: npm --prefix backend test
// Uses an in-memory database seeded from the real schema + sample data, a
// fake push sender, and an injectable clock, so nothing touches the network
// or the real food-app.sqlite.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Database = require('better-sqlite3');
const { initializeFoodData } = require('../db/foodData');
const foodRoutes = require('../routes/food');
const { generateWeek, loadPlanningContext, decideMeal } = require('../services/mealPlanner');
const { createScheduler } = require('../services/scheduler');

const SILENT_LOGGER = { log() {}, error() {} };

function createDatabase() {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT);
    CREATE TABLE push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, endpoint TEXT UNIQUE,
      p256dh TEXT, auth TEXT, user_agent TEXT
    );
  `);
  initializeFoodData(database);
  // The sample data ships a few past plan rows; treat them as already answered
  // so they do not reserve inventory in these scenarios.
  database.prepare("UPDATE weekly_meal_plan SET status = 'confirmed_skipped'").run();
  return database;
}

const recipeId = (database, name) => database.prepare('SELECT id FROM recipe WHERE name = ?').get(name).id;
const planRows = (database, where = '1 = 1') => database.prepare(`
  SELECT p.id, r.name AS recipe, p.meal_date AS date, p.meal_slot AS slot,
         p.tiffin_kid_slot AS kidSlot, p.tiffin_adult_cycle_day AS cycleDay, p.status,
         p.notified_at AS notifiedAt, p.retry_sent_at AS retrySentAt
  FROM weekly_meal_plan p JOIN recipe r ON r.id = p.recipe_id
  WHERE ${where}
  ORDER BY p.meal_date, p.meal_slot, p.id
`).all();

// Monday 2026-10-05 .. Sunday 2026-10-11. Sept lots are still AVAILABLE.
const WEEK_START = '2026-10-05';
const at = (day, hours, minutes = 0) => new Date(2026, 9, day, hours, minutes);

test('generateWeek fills the week, never promises one lot twice, and is idempotent', () => {
  const database = createDatabase();
  const summary = generateWeek(database, WEEK_START, { today: '2026-10-05' });
  const rows = planRows(database, "p.status = 'planned'");

  assert.ok(summary.created > 0);
  assert.equal(rows.length, summary.created);
  // Tiffin comes from tiffin_schedule: Wednesday is kids (AM + PM), Monday adult.
  const wednesday = rows.filter((row) => row.date === '2026-10-07' && row.slot === 'kids_tiffin');
  assert.deepEqual(wednesday.map((row) => row.kidSlot).sort(), ['AM', 'PM']);
  assert.notEqual(wednesday[0].recipe, wednesday[1].recipe);
  // Sample data has no non-Indian adult-tiffin recipe, so Monday's stays empty.
  assert.ok(summary.unfilled.some((slot) => slot.date === '2026-10-05' && slot.slot === 'adult_tiffin'));
  // Weekend lunch only on Sat/Sun; dinner is attempted every day.
  assert.deepEqual(rows.filter((row) => row.slot === 'weekend_lunch').map((row) => row.date).every(
    (date) => ['2026-10-10', '2026-10-11'].includes(date),
  ), true);

  // Inventory: 2 Bhindi lots, 1 Carrot lot => Carrot recipes appear at most once.
  const carrotRecipes = rows.filter((row) => ['Gajar Matar', 'Mixed Vegetable'].includes(row.recipe));
  assert.ok(carrotRecipes.length <= 1);
  // No recipe repeats within the week.
  assert.equal(new Set(rows.map((row) => row.recipe)).size, rows.length);

  const second = generateWeek(database, WEEK_START, { today: '2026-10-05' });
  assert.equal(second.created, 0);
  assert.equal(planRows(database, "p.status = 'planned'").length, rows.length);
});

test('generateWeek leaves manual rows and past dates alone', () => {
  const database = createDatabase();
  database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status)
    VALUES (?, '2026-10-06', 'dinner', 'planned')
  `).run(recipeId(database, 'Baingan Bharta'));

  generateWeek(database, WEEK_START, { today: '2026-10-07' });
  const rows = planRows(database, "p.status = 'planned'");
  assert.equal(rows.filter((row) => row.date < '2026-10-07' && row.recipe !== 'Baingan Bharta').length, 0);
  assert.equal(rows.filter((row) => row.date === '2026-10-06' && row.slot === 'dinner').length, 1);
  // The manual Baingan Bharta reserved its lot, so it is not planned again.
  assert.equal(rows.filter((row) => row.recipe === 'Baingan Bharta').length, 1);
});

test('decideMeal honours cooldown, away days, fasting days and festivals', () => {
  const database = createDatabase();
  const names = (date, slot = 'dinner') => decideMeal(loadPlanningContext(database), { date, slot })
    .map((entry) => entry.recipe.name);

  assert.ok(names('2026-10-08').includes('Bhindi Masala'));

  // Cooked 3 days earlier: inside the 21-day cooldown.
  database.prepare(`
    INSERT INTO meal_confirmation_log (recipe_id, cooked_date, user_response, source)
    VALUES (?, '2026-10-05', 'yes', 'manual')
  `).run(recipeId(database, 'Bhindi Masala'));
  assert.ok(!names('2026-10-08').includes('Bhindi Masala'));
  // Only 'yes' counts for cooldown: a 'no' would not block it.
  database.prepare("UPDATE meal_confirmation_log SET user_response = 'no'").run();
  assert.ok(names('2026-10-08').includes('Bhindi Masala'));
  database.prepare("UPDATE meal_confirmation_log SET user_response = 'yes'").run();

  // A long trip in between does not use up the cooldown window.
  const cookedDate = '2026-09-10';
  database.prepare('UPDATE meal_confirmation_log SET cooked_date = ?').run(cookedDate);
  assert.ok(names('2026-10-08').includes('Bhindi Masala'));       // 28 days later: allowed
  database.prepare('UPDATE meal_confirmation_log SET cooked_date = ?').run('2026-09-25');
  assert.ok(!names('2026-10-08').includes('Bhindi Masala'));      // 13 days later: blocked
  for (let day = 26; day <= 30; day += 1) {
    database.prepare("INSERT INTO away_log (away_date, reason) VALUES (?, 'vacation')").run(`2026-09-${day}`);
  }
  assert.ok(!names('2026-10-18').includes('Bhindi Masala'));      // 23 days raw, 18 counted: still blocked

  // Fasting: veg only and no onion/garlic anywhere in the recipe.
  database.prepare(`
    INSERT INTO calendar_date (calendar_date, dietary_restriction) VALUES ('2026-10-09', 'fasting')
  `).run();
  const fastingMenu = names('2026-10-09');
  assert.deepEqual(fastingMenu, ['Mixed Vegetable']);

  // Festival: only that festival's recipes are offered, family favourite first.
  const diwali = database.prepare("SELECT id FROM festival WHERE name = 'Diwali'").get().id;
  database.prepare('INSERT INTO festival_recipe (festival_id, recipe_id, family_preference) VALUES (?, ?, 0)')
    .run(diwali, recipeId(database, 'Aloo Gobi'));
  database.prepare('INSERT INTO festival_recipe (festival_id, recipe_id, family_preference) VALUES (?, ?, 1)')
    .run(diwali, recipeId(database, 'Baingan Bharta'));
  assert.deepEqual(names('2026-10-20'), ['Baingan Bharta', 'Aloo Gobi']);
});

test('weekends prefer non-veg dishes when there is no festival', () => {
  const database = createDatabase();
  const peas = database.prepare("SELECT id FROM item WHERE name = 'Peas'").get().id;
  const insertedRecipe = database.prepare(`
    INSERT INTO recipe (name, cuisine, meal_type, is_veg, suitable_for_adult_dinner, approved)
    VALUES ('Peas Keema', 'Indian', 'sabzi', 0, 1, 1)
  `).run().lastInsertRowid;
  database.prepare("INSERT INTO recipe_item (recipe_id, item_id, role) VALUES (?, ?, 'REQUIRED')").run(insertedRecipe, peas);
  database.prepare(`
    INSERT INTO inventory (item_id, purchase_date, expiry_date, status)
    VALUES (?, '2026-10-04', '2026-10-30', 'AVAILABLE')
  `).run(peas);

  const first = (date) => decideMeal(loadPlanningContext(database), { date, slot: 'dinner' })[0].recipe.name;
  assert.equal(first('2026-10-10'), 'Peas Keema');   // Saturday
  assert.notEqual(first('2026-10-07'), 'Peas Keema'); // Wednesday
});

test('scheduler: weekly generation runs once when due and catches up when missed', async () => {
  const database = createDatabase();
  const scheduler = createScheduler({
    database, sendPushToAll: async () => ({ attempted: 0, sent: 0, failed: 0 }), pushConfigured: false, logger: SILENT_LOGGER,
  });

  await scheduler.tick(at(4, 17, 59)); // Sunday before 18:00: only the missed current week is made up
  assert.equal(planRows(database, "p.meal_date >= '2026-10-05'").length, 0);

  await scheduler.tick(at(4, 18, 0));
  const generated = planRows(database, "p.meal_date >= '2026-10-05'").length;
  assert.ok(generated > 0);
  await scheduler.tick(at(4, 18, 5));
  assert.equal(planRows(database, "p.meal_date >= '2026-10-05'").length, generated);
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM scheduler_run_log WHERE job = 'weekly_generation'").get().n, 2);
});

test('scheduler: evening push, single retry, soak warning and restart safety', async () => {
  const database = createDatabase();
  database.prepare("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://push.example/1', 'k', 'a')").run();
  // Switch weekly generation off for this scenario by pre-claiming both weeks.
  ['2026-09-28', '2026-10-05'].forEach((week) => database.prepare(
    "INSERT INTO scheduler_run_log (job, run_key) VALUES ('weekly_generation', ?)",
  ).run(week));

  const bhindi = recipeId(database, 'Bhindi Masala');
  database.prepare('UPDATE recipe SET requires_soak_marination = 1 WHERE id = ?').run(bhindi);
  database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, '2026-10-05', 'dinner', 'planned')
  `).run(bhindi);
  database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, '2026-10-06', 'dinner', 'planned')
  `).run(bhindi);

  const sent = [];
  const sendPushToAll = async (payload) => { sent.push(payload); return { attempted: 1, sent: 1, failed: 0 }; };
  const build = () => createScheduler({ database, sendPushToAll, pushConfigured: true, logger: SILENT_LOGGER });
  let scheduler = build();

  await scheduler.tick(at(5, 19, 29));
  assert.equal(sent.length, 0);

  await scheduler.tick(at(5, 19, 30));
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /Did you cook Bhindi Masala\?/);
  const today = () => planRows(database, "p.meal_date = '2026-10-05'")[0];
  assert.ok(today().notifiedAt);
  assert.equal(planRows(database, "p.meal_date = '2026-10-06'")[0].notifiedAt, null);

  // A restart at 19:45 must not resend.
  scheduler = build();
  await scheduler.tick(at(5, 19, 45));
  assert.equal(sent.length, 1);

  // Soak warning at 20:00 for tomorrow's soaking recipe.
  await scheduler.tick(at(5, 20, 0));
  assert.equal(sent.length, 2);
  assert.match(sent[1].body, /requires soaking/);
  assert.match(sent[1].body, /Start soaking tonight!/);

  // Retry only after push_retry_hours (3h) since notified_at, and only once.
  await scheduler.tick(at(5, 22, 0));
  assert.equal(sent.length, 2);
  await scheduler.tick(at(5, 22, 31));
  assert.equal(sent.length, 3);
  assert.match(sent[2].title, /Still need your answer/);
  assert.ok(today().retrySentAt);
  await scheduler.tick(at(5, 23, 30));
  assert.equal(sent.length, 3);
});

test('scheduler: no retry for answered rows, no notified_at without subscribers', async () => {
  const database = createDatabase();
  ['2026-09-28', '2026-10-05'].forEach((week) => database.prepare(
    "INSERT INTO scheduler_run_log (job, run_key) VALUES ('weekly_generation', ?)",
  ).run(week));
  database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, '2026-10-05', 'dinner', 'planned')
  `).run(recipeId(database, 'Lauki Dal'));
  const sent = [];
  const noSubscribers = async (payload) => { sent.push(payload); return { attempted: 0, sent: 0, failed: 0 }; };
  await createScheduler({ database, sendPushToAll: noSubscribers, pushConfigured: true, logger: SILENT_LOGGER })
    .tick(at(5, 19, 30));
  assert.equal(planRows(database)[0].notifiedAt, null);

  database.prepare("UPDATE weekly_meal_plan SET notified_at = '2026-10-05 23:30:00'").run();
  database.prepare("UPDATE weekly_meal_plan SET status = 'confirmed_skipped'").run();
  const before = sent.length;
  await createScheduler({ database, sendPushToAll: noSubscribers, pushConfigured: true, logger: SILENT_LOGGER })
    .tick(at(6, 12, 0));
  assert.equal(sent.length, before);
});

async function withApi(database, run) {
  const app = express();
  app.use(express.json());
  app.use('/api/food', foodRoutes(database));
  const server = await new Promise((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  const base = `http://127.0.0.1:${server.address().port}/api/food`;
  const call = async (path, body) => {
    const response = await fetch(`${base}${path}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try { await run(call); } finally { server.close(); }
}

test('catch-up: lists unconfirmed past meals and applies cooked / skipped / away', async () => {
  const database = createDatabase();
  const insert = database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, ?, 'adult_tiffin', 'planned')
  `);
  const cooked = insert.run(recipeId(database, 'Bhindi Masala'), '2026-10-01').lastInsertRowid;
  const skipped = insert.run(recipeId(database, 'Lauki Dal'), '2026-10-02').lastInsertRowid;
  const away = insert.run(recipeId(database, 'Baingan Bharta'), '2026-10-03').lastInsertRowid;
  insert.run(recipeId(database, 'Palak Dal'), '2026-09-20'); // older than the 7-day window

  await withApi(database, async (call) => {
    const dashboard = await call(`/?weekStart=${WEEK_START}&today=2026-10-05`);
    assert.equal(dashboard.body.catchupLookbackDays, 7);
    assert.deepEqual(dashboard.body.unconfirmed.map((row) => row.id), [cooked, skipped, away].map(Number));

    const bad = await call('/catchup', { responses: [{ planId: Number(cooked), response: 'eaten' }] });
    assert.equal(bad.status, 400);

    const saved = await call('/catchup', { responses: [
      { planId: Number(cooked), response: 'cooked' },
      { planId: Number(skipped), response: 'skipped' },
      { planId: Number(away), response: 'away' },
    ] });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.saved, 3);
    assert.deepEqual(saved.body.consumed.map((entry) => entry.item), ['Bhindi']);

    const statuses = Object.fromEntries(planRows(database, "p.meal_date BETWEEN '2026-10-01' AND '2026-10-03'")
      .map((row) => [row.recipe, row.status]));
    assert.deepEqual(statuses, {
      'Bhindi Masala': 'confirmed_cooked', 'Lauki Dal': 'confirmed_skipped', 'Baingan Bharta': 'confirmed_skipped',
    });
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM inventory WHERE status = 'USED'").get().n, 1);
    assert.equal(database.prepare('SELECT away_date AS d FROM away_log').get().d, '2026-10-03');
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM meal_confirmation_log').get().n, 3);

    const again = await call('/catchup', { responses: [{ planId: Number(cooked), response: 'skipped' }] });
    assert.equal(again.body.alreadyAnswered, 1);
    assert.equal(again.body.saved, 0);
  });
});

test('past kids/lunch/dinner rows are still assumed cooked when the dashboard loads', async () => {
  const database = createDatabase();
  database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, '2026-10-02', 'dinner', 'planned')
  `).run(recipeId(database, 'Bhindi Masala'));
  await withApi(database, async (call) => {
    const dashboard = await call(`/?weekStart=${WEEK_START}&today=2026-10-05`);
    assert.equal(dashboard.body.unconfirmed.length, 0);
    assert.equal(planRows(database, "p.meal_date = '2026-10-02'")[0].status, 'confirmed_cooked');
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM inventory WHERE status = 'USED'").get().n, 1);
  });
});

test('generate + inventory endpoints', async () => {
  const database = createDatabase();
  await withApi(database, async (call) => {
    assert.equal((await call('/plan/generate', { weekStart: '2026-10-06' })).status, 400); // not a Monday
    const generated = await call('/plan/generate', { weekStart: WEEK_START, today: '2026-10-05' });
    assert.equal(generated.status, 201);
    assert.ok(generated.body.created > 0);

    const available = await call('/inventory?today=2026-10-05');
    assert.equal(available.status, 200);
    assert.ok(available.body.lots.length >= 7);
    assert.ok(available.body.lots.every((lot) => lot.status === 'AVAILABLE'));
    const bhindi = available.body.lots.find((lot) => lot.item_name === 'Bhindi' && lot.purchase_date === '2026-09-22');
    assert.equal(bhindi.freshness, 'Old');
    assert.equal(available.body.lots[0].expiry_date <= available.body.lots.at(-1).expiry_date, true);

    assert.equal((await call('/inventory?status=BOGUS')).status, 400);
    assert.equal((await call('/inventory?status=USED')).body.lots.length, 0);
    assert.equal((await call('/inventory?status=all')).body.lots.length, available.body.lots.length);
  });
});
