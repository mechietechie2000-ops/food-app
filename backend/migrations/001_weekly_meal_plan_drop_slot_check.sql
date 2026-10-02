-- ============================================================================
-- 001_weekly_meal_plan_drop_slot_check.sql            (SQLite, run BEFORE deploying the code patch)
--
-- Why: weekly_meal_plan.meal_slot has a CHECK that only allows
--      kids_tiffin / adult_tiffin / dinner / weekend_lunch.
--      The app now also writes: breakfast, sides, guest_special.
--      SQLite cannot "ALTER TABLE ... DROP CONSTRAINT", so the table is
--      rebuilt with the same columns, defaults, FKs and indexes, MINUS the
--      meal_slot CHECK. Slot names are validated by the API instead.
--      Every other CHECK (tiffin_kid_slot, tiffin_adult_cycle_day, status) is kept.
--
-- What it does NOT touch: any other table. Row ids are preserved, so
--      meal_confirmation_log.plan_id keeps pointing at the right rows.
--
-- How to run (stop the API first):
--   1. cp backend/data/food-app.sqlite backend/data/food-app.sqlite.bak
--      (with WAL mode also copy the -wal and -shm files, or run
--       `sqlite3 food-app.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"` first)
--   2. sqlite3 backend/data/food-app.sqlite < 001_weekly_meal_plan_drop_slot_check.sql
--   3. Expect no output from the two verification queries at the bottom
--      (foreign_key_check returns nothing; the row counts match).
--
-- Safe to re-run: it rebuilds the table again with the same result.
-- Rollback: stop the API, then restore the .bak copy.
-- ============================================================================

PRAGMA foreign_keys = OFF;   -- must be set outside the transaction

BEGIN TRANSACTION;

DROP TABLE IF EXISTS weekly_meal_plan_new;

CREATE TABLE weekly_meal_plan_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    meal_date TEXT NOT NULL,
    meal_slot TEXT NOT NULL,
    tiffin_kid_slot TEXT CHECK (tiffin_kid_slot IN ('AM', 'PM')),
    tiffin_adult_cycle_day INTEGER CHECK (tiffin_adult_cycle_day IN (1, 2)),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed_cooked', 'confirmed_skipped', 'other', 'replaced')),
    notified_at TEXT,
    retry_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);

INSERT INTO weekly_meal_plan_new
    (id, recipe_id, meal_date, meal_slot, tiffin_kid_slot, tiffin_adult_cycle_day,
     status, notified_at, retry_sent_at, created_at)
SELECT id, recipe_id, meal_date, meal_slot, tiffin_kid_slot, tiffin_adult_cycle_day,
       status, notified_at, retry_sent_at, created_at
FROM weekly_meal_plan;

DROP TABLE weekly_meal_plan;                          -- drops its old indexes too
ALTER TABLE weekly_meal_plan_new RENAME TO weekly_meal_plan;

CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_date ON weekly_meal_plan(meal_date);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_recipe ON weekly_meal_plan(recipe_id);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_status ON weekly_meal_plan(status);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_date_status ON weekly_meal_plan(meal_date, status);

COMMIT;

PRAGMA foreign_keys = ON;

-- Verification: both should print nothing / matching counts.
PRAGMA foreign_key_check;
SELECT COUNT(*) AS plan_rows_after FROM weekly_meal_plan;
