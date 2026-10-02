// Reads the two hand-editable JSON lists (breakfast ideas, kids protein) and
// copies them into the recipe table so plan rows can point at them.
//
// Seeding only ADDS rows (INSERT OR IGNORE by name): editing a recipe in the
// database, e.g. un-approving it, is never overwritten by a restart.
const fs = require('node:fs');
const path = require('node:path');
const { MEAL_TYPE } = require('./slots');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const BREAKFAST_PATH = path.join(CONFIG_DIR, 'breakfast-ideas.json');
const KIDS_PROTEIN_PATH = path.join(CONFIG_DIR, 'kids-protein.json');
const SIDE_COOLDOWN_DAYS = 0; // repeat spacing for sides is handled by the planner

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function loadBreakfastIdeas() {
  const { ideas = [], weekdays = [] } = readJson(BREAKFAST_PATH);
  return { ideas, weekdays };
}

function loadKidsProtein() {
  return readJson(KIDS_PROTEIN_PATH);
}

function seedJsonRecipes(database) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO recipe
      (name, description, cuisine, meal_type, is_veg, requires_soak_marination,
       soak_time_hours, approved, cooldown_days)
    VALUES (?, ?, 'Indian', ?, ?, ?, ?, 1, ?)
  `);

  database.transaction(() => {
    loadBreakfastIdeas().ideas.forEach((idea) => {
      insert.run(
        idea.name,
        'Weekday breakfast idea, no added sugar.',
        MEAL_TYPE.BREAKFAST,
        idea.veg === false ? 0 : 1,
        idea.overnightPrep ? 1 : 0,
        idea.overnightPrep ? Number(idea.soakHours) || 0 : 0,
        SIDE_COOLDOWN_DAYS,
      );
    });

    const { pools } = loadKidsProtein();
    Object.entries(pools).forEach(([poolName, entries]) => {
      const mealType = poolName === 'weekend_sides' ? MEAL_TYPE.WEEKEND_SIDE : MEAL_TYPE.PROTEIN_SIDE;
      entries.forEach((entry) => {
        insert.run(
          entry.name,
          poolName === 'weekend_sides' ? 'Weekend side for kids.' : 'Protein portion for kids.',
          mealType,
          entry.veg === false ? 0 : 1,
          0,
          0,
          SIDE_COOLDOWN_DAYS,
        );
      });
    });
  })();
}

module.exports = { loadBreakfastIdeas, loadKidsProtein, seedJsonRecipes };
