const fs = require('node:fs');
const path = require('node:path');
const { seedJsonRecipes } = require('../services/jsonRecipes');

function initializeFoodData(database) {
  const schemaPath = path.join(__dirname, '..', 'food_app_schema_final.sql');
  const samplePath = path.join(__dirname, '..', 'food-app-sample-data.sql');

  database.exec(fs.readFileSync(schemaPath, 'utf8'));
  database.exec(fs.readFileSync(samplePath, 'utf8'));
  seedJsonRecipes(database);
}

module.exports = { initializeFoodData };
