const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(__dirname, "..", "..", "routine.db");

// 1. Initialize better-sqlite3 (synchronous)
let db;
try {
  db = new Database(dbPath);
  console.log("[sqliteDriver] connected:", dbPath);

  // Enable WAL mode for better performance & concurrent read/write handling
  db.pragma("journal_mode = WAL");

  // 2. Read and apply schema(s)
  const schemaPaths = [
    // path.resolve(__dirname, "..", "schema.sql"), -- main sql is home_dashboard_schema.sql 
    path.resolve(__dirname, "..", "home_dashboard_schema.sql"),
    path.resolve(__dirname, "..", "reminder_schema.sql"),
  ];
  for (const schemaPath of schemaPaths) {
    if (fs.existsSync(schemaPath)) {
      db.exec(fs.readFileSync(schemaPath, "utf8"));
      console.log(`[sqliteDriver] schema executed: ${schemaPath}`);
    }
  }

  // 3. Apply any migrations not covered by the (additive-only) schema files
  // above — e.g. renaming/altering tables that already have data. Each
  // migration is idempotent and safe to run on every boot.
/*   const migrations = [require("../migrations/001_reminders_appointments")];
  for (const migration of migrations) {
    migration.run(db);
  } */
} catch (err) {
  console.error("[sqliteDriver] error:", err.message);
}

// 3. Implement driver methods matching connection interface using better-sqlite3
async function all(sql, params = []) {
  return db.prepare(sql).all(params);
}

async function run(sql, params = []) {
  const info = db.prepare(sql).run(params);
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

async function get(sql, params = []) {
  return db.prepare(sql).get(params);
}

module.exports = { all, run, get };