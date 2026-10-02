// Run with: npm --prefix backend test
// Covers: deleting pending grocery items, the breakfast / sides / guest_special
// slots, the kids protein rules (issue #4), the JSON lists, and the expanded
// Indian recipe seed. Uses an in-memory database and the real schema + seed.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Database = require('better-sqlite3');
const { initializeFoodData } = require('../db/foodData');
const foodRoutes = require('../routes/food');
const { generateWeek, loadPlanningContext, decideMeal } = require('../services/mealPlanner');
const { createScheduler } = require('../services/scheduler');
const { seedJsonRecipes, loadBreakfastIdeas, loadKidsProtein } = require('../services/jsonRecipes');

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
  database.prepare("UPDATE weekly_meal_plan SET status = 'confirmed_skipped'").run();
  return database;
}

const recipeId = (database, name) => database.prepare('SELECT id FROM recipe WHERE name = ?').get(name).id;
const sidesOn = (database, date) => database.prepare(`
  SELECT r.name, r.meal_type AS mealType
  FROM weekly_meal_plan p JOIN recipe r ON r.id = p.recipe_id
  WHERE p.meal_slot = 'sides' AND p.meal_date = ?
  ORDER BY p.id
`).all(date);
const poolNames = (pool) => new Set(loadKidsProtein().pools[pool].map((entry) => entry.name));

async function withApi(database, run) {
  const app = express();
  app.use(express.json());
  app.use('/api/food', foodRoutes(database));
  const server = await new Promise((resolve) => { const listening = app.listen(0, () => resolve(listening)); });
  const base = `http://127.0.0.1:${server.address().port}/api/food`;
  const call = async (path, { method, body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try { await run(call); } finally { server.close(); }
}

// ---------------------------------------------------------------------------
// Issue #1: delete a pending grocery item
// ---------------------------------------------------------------------------

test('grocery list: a pending item can be deleted, a purchased one cannot', async () => {
  const database = createDatabase();
  const itemId = (name) => database.prepare('SELECT id FROM item WHERE name = ?').get(name).id;

  await withApi(database, async (call) => {
    await call('/groceries/stage', { body: { itemIds: [itemId('Carrot'), itemId('Peas'), itemId('Cabbage')] } });
    const pending = () => database.prepare('SELECT id, item_id FROM grocery_stage WHERE is_purchased = 0 ORDER BY id').all();
    const [carrot, peas, cabbage] = pending();

    // Confirm two, delete the third: nothing is left pending.
    const confirmed = await call('/groceries/confirm', { body: { stageIds: [carrot.id, peas.id], purchaseDate: '2026-09-28' } });
    assert.equal(confirmed.status, 201);
    assert.equal(pending().length, 1);

    assert.equal((await call(`/groceries/stage/${carrot.id}`, { method: 'DELETE' })).status, 404); // already purchased
    const deleted = await call(`/groceries/stage/${cabbage.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    assert.equal(pending().length, 0);
    assert.equal((await call(`/groceries/stage/${cabbage.id}`, { method: 'DELETE' })).status, 404); // gone
    assert.equal((await call('/groceries/stage/abc', { method: 'DELETE' })).status, 400);
    assert.equal((await call('/groceries/stage/0', { method: 'DELETE' })).status, 400);

    // The purchased rows and their inventory lots are untouched.
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM grocery_stage WHERE is_purchased = 1').get().n, 2);
    const dashboard = await call('/?weekStart=2026-10-05&today=2026-10-05');
    assert.equal(dashboard.body.groceryStage.length, 0);
  });
});

// ---------------------------------------------------------------------------
// New slots: breakfast, sides, guest_special
// ---------------------------------------------------------------------------

test('slots: breakfast, sides and guest_special accept only their own recipes', async () => {
  const database = createDatabase();
  const plan = (call, name, date, slot) => call('/plan', { body: { recipeId: recipeId(database, name), mealDate: date, mealSlot: slot } });

  await withApi(database, async (call) => {
    assert.equal((await plan(call, 'Overnight oats with chia seeds, banana and cinnamon', '2026-10-06', 'breakfast')).status, 201);
    assert.equal((await plan(call, 'Boiled egg', '2026-10-06', 'sides')).status, 201);
    assert.equal((await plan(call, 'Butter Chicken', '2026-10-10', 'guest_special')).status, 201);
    // Pantry mains (no fresh vegetable) can also be planned by hand for dinner.
    assert.equal((await plan(call, 'Dal Tadka', '2026-10-07', 'dinner')).status, 201);

    // Wrong recipe kind for the slot.
    assert.equal((await plan(call, 'Butter Chicken', '2026-10-06', 'breakfast')).status, 409);
    assert.equal((await plan(call, 'Boiled egg', '2026-10-06', 'dinner')).status, 409);
    assert.equal((await plan(call, 'Overnight oats with chia seeds, banana and cinnamon', '2026-10-06', 'sides')).status, 409);
    assert.equal((await plan(call, 'Overnight oats with chia seeds, banana and cinnamon', '2026-10-06', 'guest_special')).status, 409);
    // Unknown slot.
    assert.equal((await plan(call, 'Dal Tadka', '2026-10-07', 'brunch')).status, 400);

    const { body } = await call('/?weekStart=2026-10-05&today=2026-10-05');
    const names = (slot) => body.slotRecipes[slot].map((recipe) => recipe.name);
    assert.equal(names('breakfast').length, loadBreakfastIdeas().ideas.length);
    assert.ok(names('breakfast').every((name) => loadBreakfastIdeas().ideas.some((idea) => idea.name === name)));
    assert.ok(names('sides').includes('Boiled egg') && names('sides').includes('Potato chili'));
    assert.ok(names('guest_special').includes('Butter Chicken') && names('guest_special').includes('Bhindi Masala'));
    assert.ok(!names('guest_special').includes('Boiled egg'));
    // Main-dish slots never offer breakfast or kids sides.
    ['dinner', 'weekend_lunch', 'kids_tiffin'].forEach((slot) => {
      assert.ok(!names(slot).includes('Boiled egg'));
      assert.ok(!names(slot).some((name) => name.startsWith('Overnight oats')));
    });
    assert.ok(names('dinner').includes('Dal Tadka'));
    assert.ok(!names('kids_tiffin').includes('Butter Chicken')); // not marked kid-friendly
    assert.ok(body.plan.some((row) => row.meal_slot === 'breakfast'));
  });
});

test('slots: breakfast, sides and guest rows are never confirmed, pushed or caught up', async () => {
  const database = createDatabase();
  const insert = database.prepare(`
    INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, ?, ?, 'planned')
  `);
  const oats = recipeId(database, 'Overnight oats with chia seeds, banana and cinnamon');
  const breakfast = insert.run(oats, '2026-10-05', 'breakfast').lastInsertRowid;
  insert.run(recipeId(database, 'Boiled egg'), '2026-10-05', 'sides');
  insert.run(recipeId(database, 'Butter Chicken'), '2026-10-05', 'guest_special');
  insert.run(oats, '2026-10-06', 'breakfast'); // tomorrow: soak reminder

  const sent = [];
  const scheduler = createScheduler({
    database,
    sendPushToAll: async (payload) => { sent.push(payload); return { attempted: 1, sent: 1, failed: 0 }; },
    pushConfigured: true,
    logger: SILENT_LOGGER,
  });
  await scheduler.tick(new Date(2026, 9, 5, 19, 30));
  // Weekly generation may have added real dinner rows, which do get the push;
  // the breakfast, sides and guest rows must not be mentioned or marked notified.
  sent.filter((payload) => payload.title === 'Did you cook today?').forEach((payload) => {
    assert.doesNotMatch(payload.body, /Overnight oats|Boiled egg|Butter Chicken/);
  });
  assert.equal(database.prepare(`
    SELECT COUNT(*) AS n FROM weekly_meal_plan
    WHERE meal_slot IN ('breakfast', 'sides', 'guest_special') AND meal_date = '2026-10-05' AND notified_at IS NOT NULL
  `).get().n, 0);
  await scheduler.tick(new Date(2026, 9, 5, 20, 0));
  const soak = sent.find((payload) => payload.title === 'Soak tonight');
  assert.ok(soak, 'overnight breakfast should trigger the soak reminder');
  assert.match(soak.body, /breakfast/);

  await withApi(database, async (call) => {
    assert.equal((await call(`/plan/${breakfast}/confirm`, { body: { response: 'yes' } })).status, 409);
    assert.equal((await call(`/plan/${breakfast}/confirm`, { body: { response: 'no' } })).status, 409);
    // 2026-10-05 is in the past for this dashboard call: still not "unconfirmed".
    const dashboard = await call('/?weekStart=2026-10-05&today=2026-10-07');
    assert.equal(dashboard.body.unconfirmed.length, 0);
  });
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM meal_confirmation_log WHERE recipe_id = ?").get(oats).n, 0);
});

// ---------------------------------------------------------------------------
// Issue #4: kids protein rules
// ---------------------------------------------------------------------------

test('kids protein: veg-only weekdays use paneer/soya, summer uses curd, otherwise egg', () => {
  const database = createDatabase();
  const restricted = poolNames('veg_restricted_days');
  const summer = poolNames('summer');
  const eggs = poolNames('default');
  const weekend = poolNames('weekend_sides');

  // Summer week (August): Mon 2026-08-03 .. Sun 2026-08-09.
  generateWeek(database, '2026-08-03', { today: '2026-08-03' });
  const one = (date) => sidesOn(database, date).filter((row) => row.mealType === 'protein_side').map((row) => row.name);
  ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-08', '2026-08-09'].forEach((date) => {
    assert.ok(summer.has(one(date)[0]), `${date} should be a curd-family side, got ${one(date)}`);
  });
  ['2026-08-04', '2026-08-06'].forEach((date) => { // Tuesday, Thursday
    assert.ok(restricted.has(one(date)[0]), `${date} should be paneer/chole/soya, got ${one(date)}`);
  });
  // Saturday and Sunday also get one weekend side.
  ['2026-08-08', '2026-08-09'].forEach((date) => {
    const extra = sidesOn(database, date).filter((row) => row.mealType === 'weekend_side');
    assert.equal(extra.length, 1);
    assert.ok(weekend.has(extra[0].name));
  });
  assert.equal(sidesOn(database, '2026-08-03').length, 1);

  // Winter week (October): egg on ordinary days, paneer/soya on Tue/Thu.
  generateWeek(database, '2026-10-05', { today: '2026-10-05' });
  ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-10', '2026-10-11'].forEach((date) => {
    assert.ok(eggs.has(one(date)[0]), `${date} should be egg, got ${one(date)}`);
  });
  ['2026-10-06', '2026-10-08'].forEach((date) => assert.ok(restricted.has(one(date)[0])));

  // September is still summer (June to September); October is not.
  generateWeek(database, '2026-09-28', { today: '2026-09-28' });
  assert.ok(summer.has(one('2026-09-28')[0]));
  assert.ok(restricted.has(one('2026-10-01')[0]));
});

test('kids protein: festivals and strict-veg days switch to the vegetarian pool, and reruns add nothing', () => {
  const database = createDatabase();
  // 2026-10-20 (Tuesday, seeded Diwali sample) would be restricted anyway; use a Wednesday.
  const diwali = database.prepare("SELECT id FROM festival WHERE name = 'Diwali'").get().id;
  database.prepare("INSERT INTO calendar_date (calendar_date, festival_id, dietary_restriction) VALUES ('2026-10-21', ?, 'none')").run(diwali);
  database.prepare("INSERT INTO calendar_date (calendar_date, dietary_restriction) VALUES ('2026-10-23', 'strict_veg')").run();

  const first = generateWeek(database, '2026-10-19', { today: '2026-10-19' });
  const pick = (date) => sidesOn(database, date).find((row) => row.mealType === 'protein_side').name;
  assert.ok(poolNames('veg_restricted_days').has(pick('2026-10-21'))); // Wednesday festival
  assert.ok(poolNames('veg_restricted_days').has(pick('2026-10-23'))); // Friday strict veg
  assert.ok(poolNames('veg_restricted_days').has(pick('2026-10-22'))); // Thursday: veg-only weekday
  assert.ok(poolNames('default').has(pick('2026-10-19')));             // Monday: plain egg day

  const sideCount = database.prepare("SELECT COUNT(*) AS n FROM weekly_meal_plan WHERE meal_slot = 'sides'").get().n;
  const second = generateWeek(database, '2026-10-19', { today: '2026-10-19' });
  assert.equal(second.created, 0);
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM weekly_meal_plan WHERE meal_slot = 'sides'").get().n, sideCount);
  assert.ok(first.created > 0);

  // A manual side is never replaced or duplicated.
  const manualDb = createDatabase();
  manualDb.prepare("INSERT INTO weekly_meal_plan (recipe_id, meal_date, meal_slot, status) VALUES (?, '2026-10-05', 'sides', 'planned')")
    .run(recipeId(manualDb, 'Scrambled eggs'));
  generateWeek(manualDb, '2026-10-05', { today: '2026-10-05' });
  assert.deepEqual(sidesOn(manualDb, '2026-10-05').filter((row) => row.mealType === 'protein_side').map((row) => row.name), ['Scrambled eggs']);
});

test('kids protein: the same side is not repeated on back-to-back days', () => {
  const database = createDatabase();
  generateWeek(database, '2026-08-03', { today: '2026-08-03' });
  generateWeek(database, '2026-08-10', { today: '2026-08-10' });
  const sides = database.prepare(`
    SELECT p.meal_date AS date, r.name FROM weekly_meal_plan p JOIN recipe r ON r.id = p.recipe_id
    WHERE p.meal_slot = 'sides' AND r.meal_type = 'protein_side' ORDER BY p.meal_date
  `).all();
  assert.equal(sides.length, 14);
  for (let index = 1; index < sides.length; index += 1) {
    assert.notEqual(sides[index].name, sides[index - 1].name);
  }
});

// ---------------------------------------------------------------------------
// JSON lists and seeding
// ---------------------------------------------------------------------------

test('breakfast ideas: one-liners, unique ids, no added sugar, overnight items flagged', () => {
  const { ideas, weekdays } = loadBreakfastIdeas();
  assert.deepEqual(weekdays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.ok(ideas.length >= 25);
  assert.equal(new Set(ideas.map((idea) => idea.id)).size, ideas.length);
  assert.equal(new Set(ideas.map((idea) => idea.name)).size, ideas.length);
  const added = /\b(sugar|jaggery|gur|honey|syrup|jam|sweetened|sweetener|maple|molasses)\b/i;
  ideas.forEach((idea) => {
    assert.ok(idea.name.length > 0 && !idea.name.includes('\n'));
    assert.ok(!added.test(idea.name), `no added sugar: ${idea.name}`);
    assert.equal(typeof idea.veg, 'boolean');
    if (idea.overnightPrep) assert.ok(idea.soakHours > 0);
  });
  assert.ok(ideas.some((idea) => idea.overnightPrep));
  ['Avocado toast', 'Chana salad', 'Chole salad'].forEach((start) => {
    assert.ok(ideas.some((idea) => idea.name.startsWith(start)), `${start} (from issue #4) is in the list`);
  });
  // Sorted, so the browse page reads alphabetically.
  const sorted = [...ideas].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  assert.deepEqual(ideas.map((idea) => idea.id), sorted.map((idea) => idea.id));
});

test('kids protein list matches issue #4 and every pool is non-empty and sorted', () => {
  const { pools, summerMonths, vegOnlyWeekdays } = loadKidsProtein();
  assert.deepEqual(summerMonths, [6, 7, 8, 9]);
  assert.deepEqual(vegOnlyWeekdays, ['Tuesday', 'Thursday']);
  const all = Object.values(pools).flat();
  assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
  assert.equal(new Set(all.map((entry) => entry.name)).size, all.length);
  Object.entries(pools).forEach(([pool, entries]) => {
    assert.ok(entries.length >= 6, `${pool} has enough variety`);
    const names = entries.map((entry) => entry.name.toLowerCase());
    assert.deepEqual(names, [...names].sort());
  });
  const text = (pool) => pools[pool].map((entry) => entry.name).join(' ');
  assert.match(text('veg_restricted_days'), /paneer/i);
  assert.match(text('veg_restricted_days'), /chole/i);
  assert.match(text('veg_restricted_days'), /soya/i);
  assert.match(text('summer'), /yogurt/i);
  assert.match(text('summer'), /lassi/i);
  assert.match(text('summer'), /chhach/i);
  assert.ok(pools.default.every((entry) => /egg|omelette/i.test(entry.name) && entry.veg === false));
  assert.match(text('weekend_sides'), /Chana salad/);
  assert.match(text('weekend_sides'), /Peanut masala/);
  assert.match(text('weekend_sides'), /Avocado/);
  assert.match(text('weekend_sides'), /Potato chili/);
});

test('JSON seeding only adds: it is idempotent and never overwrites edits', () => {
  const database = createDatabase();
  const count = () => database.prepare("SELECT COUNT(*) AS n FROM recipe WHERE meal_type IN ('breakfast', 'protein_side', 'weekend_side')").get().n;
  const before = count();
  const { pools, ideas } = { pools: loadKidsProtein().pools, ideas: loadBreakfastIdeas().ideas };
  assert.equal(before, ideas.length + Object.values(pools).flat().length);

  database.prepare("UPDATE recipe SET approved = 0 WHERE name = 'Boiled egg'").run();
  seedJsonRecipes(database);
  seedJsonRecipes(database);
  assert.equal(count(), before);
  assert.equal(database.prepare("SELECT approved FROM recipe WHERE name = 'Boiled egg'").get().approved, 0);

  const overnight = database.prepare("SELECT requires_soak_marination AS soak, soak_time_hours AS hours FROM recipe WHERE name = ?")
    .get('Overnight oats with chia seeds, banana and cinnamon');
  assert.deepEqual(overnight, { soak: 1, hours: 6 });
  assert.equal(database.prepare("SELECT is_veg FROM recipe WHERE name = 'Boiled egg'").get().is_veg, 0);
});

// ---------------------------------------------------------------------------
// Expanded Indian recipe list
// ---------------------------------------------------------------------------

test('expanded recipe list: veg and non-veg, every recipe has real ingredients', () => {
  const database = createDatabase();
  const mains = database.prepare(`
    SELECT id, name, is_veg AS isVeg, cuisine, suitable_for_adult_tiffin AS adultTiffin
    FROM recipe WHERE meal_type IN ('sabzi', 'dal', 'curry', 'rice')
  `).all();
  assert.ok(mains.length >= 40, `expected 40+ main dishes, got ${mains.length}`);
  assert.ok(mains.filter((recipe) => recipe.isVeg).length >= 20);
  assert.ok(mains.filter((recipe) => !recipe.isVeg).length >= 15);
  assert.ok(mains.every((recipe) => recipe.cuisine === 'Indian'));
  // Indian dishes are never adult-tiffin candidates (tiffin must be non-Indian).
  assert.ok(mains.every((recipe) => !recipe.adultTiffin));

  // The seed joins by name: a typo would silently drop ingredients, so check.
  const withoutRequired = mains.filter((recipe) => !database.prepare(
    "SELECT 1 FROM recipe_item WHERE recipe_id = ? AND role = 'REQUIRED'",
  ).get(recipe.id));
  assert.deepEqual(withoutRequired.map((recipe) => recipe.name), []);

  // Non-veg proteins are always-available pantry items, not inventory lots.
  const proteins = database.prepare("SELECT name, always_available AS always, inventory_type AS type, is_veg AS isVeg FROM item WHERE name IN ('Chicken','Mutton','Fish','Prawns','Eggs')").all();
  assert.equal(proteins.length, 5);
  assert.ok(proteins.every((item) => item.always === 1 && item.type === 'STAPLE' && item.isVeg === 0));
  // New fresh vegetables show up in the grocery list; proteins do not.
  const fresh = database.prepare("SELECT name FROM item WHERE inventory_type = 'FRESH'").all().map((item) => item.name);
  ['Karela', 'Kaddu', 'Mushroom', 'Beetroot', 'Broccoli', 'Tinda'].forEach((name) => assert.ok(fresh.includes(name)));
  assert.ok(!fresh.includes('Chicken') && !fresh.includes('Paneer'));

  // Marinating and soaking dishes feed the 8 pm reminder.
  const soaked = database.prepare("SELECT name FROM recipe WHERE requires_soak_marination = 1 AND meal_type IN ('sabzi','dal','curry','rice')").all().map((row) => row.name);
  ['Chole (Punjabi)', 'Dal Makhani', 'Tandoori Chicken', 'Chicken Biryani'].forEach((name) => assert.ok(soaked.includes(name)));
});

test('expanded recipe list: fresh-vegetable dishes join the planner, pantry dishes stay manual', () => {
  const database = createDatabase();
  const names = (date, slot = 'dinner') => decideMeal(loadPlanningContext(database), { date, slot }).map((entry) => entry.recipe.name);
  const saturday = names('2026-10-10');
  // Spinach is in stock: Palak Paneer / Palak Chicken are candidates, and on a
  // weekend the non-veg dish ranks ahead of the vegetarian ones.
  assert.ok(saturday.includes('Palak Chicken') && saturday.includes('Palak Paneer'));
  assert.ok(saturday.indexOf('Palak Chicken') < saturday.indexOf('Palak Paneer'));
  // No fresh vegetable needed => never auto-planned.
  assert.ok(!saturday.includes('Butter Chicken') && !saturday.includes('Dal Tadka'));
  // Breakfast and sides never leak into main-dish planning.
  assert.ok(!saturday.some((name) => name === 'Boiled egg' || name.startsWith('Overnight oats')));
  // On a fasting day non-veg is dropped.
  database.prepare("INSERT INTO calendar_date (calendar_date, dietary_restriction) VALUES ('2026-10-10', 'fasting')").run();
  assert.ok(!names('2026-10-10').includes('Palak Chicken'));
});
