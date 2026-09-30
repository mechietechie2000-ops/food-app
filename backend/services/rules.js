// Loads config/rules.json once. Keeping tunable numbers and schedule times in
// JSON (spec Section 8, rule 4) means nothing below hardcodes them.
const fs = require('node:fs');
const path = require('node:path');

const RULES_PATH = path.join(__dirname, '..', 'config', 'rules.json');

const rules = Object.freeze(JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')));

module.exports = { rules };
