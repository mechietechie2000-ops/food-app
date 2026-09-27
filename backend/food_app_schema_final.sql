-- Food App SQLite Schema (merged v1, final for this round)
-- Combines: normalized SUGGESTED->COOKED meal tracking + full indexing (schema.sql)
-- with: grocery_stage intake flow, recipe suitability flags, guest table,
--       dietary-restriction awareness (schema2.sql), and a user-editable
--       tiffin schedule (weekday defaults + one-week-ahead overrides).
-- Quantity/partial-consumption is intentionally NOT tracked anywhere:
-- the house rule is "an item is either available or fully used."
-- iMessage confirmation path is dropped for v1 (app confirmation only).
--
-- SQLite compatible. Application must enable: PRAGMA foreign_keys = ON;

PRAGMA foreign_keys = ON;

-- ============================================================
-- ITEMS (master reference for anything in the grocery form / inventory)
-- category drives the two-column checkbox UI grouping (config/ui_form_categories.json
-- should mirror these category values, not duplicate them).
-- ============================================================
CREATE TABLE IF NOT EXISTS item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('green_veggie', 'staple', 'dal', 'spice', 'protein', 'other')),
    inventory_type TEXT NOT NULL CHECK (inventory_type IN ('FRESH', 'STAPLE')),
    is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
    default_shelf_life_days INTEGER NOT NULL DEFAULT 7,
    always_available INTEGER NOT NULL DEFAULT 0 CHECK (always_available IN (0, 1)),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_item_category ON item(category);
CREATE INDEX IF NOT EXISTS idx_item_type ON item(inventory_type);
CREATE INDEX IF NOT EXISTS idx_item_active ON item(active);

-- ============================================================
-- GROCERY STAGE (intake from form or future receipt parser)
-- Rows here are a PENDING request, not a purchase. They only move into
-- `inventory` after the user runs the confirmation step (spec Section 2.2).
-- ============================================================
CREATE TABLE IF NOT EXISTS grocery_stage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'receipt')),
    is_purchased INTEGER NOT NULL DEFAULT 0 CHECK (is_purchased IN (0, 1)),
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT,
    FOREIGN KEY (item_id) REFERENCES item(id)
);
CREATE INDEX IF NOT EXISTS idx_grocery_stage_item ON grocery_stage(item_id);
CREATE INDEX IF NOT EXISTS idx_grocery_stage_purchased ON grocery_stage(is_purchased);

-- ============================================================
-- INVENTORY (one row per purchased lot; no quantity, only AVAILABLE/USED/DISCARDED)
-- expiry_date is populated at insert time as purchase_date + item.default_shelf_life_days,
-- so freshness/use-soon ranking never needs a join back to `item` at query time.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    purchase_date TEXT NOT NULL,
    expiry_date TEXT,
    store TEXT,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'DISCARDED')),
    used_date TEXT,
    FOREIGN KEY (item_id) REFERENCES item(id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON inventory(item_id, status, purchase_date);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);

-- ============================================================
-- RECIPES (suitability flags encode the meal rules directly, so the
-- decide_meal() pipeline mostly filters columns instead of hardcoding logic)
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    instructions TEXT,
    cuisine TEXT NOT NULL DEFAULT 'Indian',
    meal_type TEXT,
    is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
    is_frozen_friendly INTEGER NOT NULL DEFAULT 0 CHECK (is_frozen_friendly IN (0, 1)),
    requires_soak_marination INTEGER NOT NULL DEFAULT 0 CHECK (requires_soak_marination IN (0, 1)),
    soak_time_hours INTEGER NOT NULL DEFAULT 0,
    suitable_for_kids_tiffin INTEGER NOT NULL DEFAULT 0 CHECK (suitable_for_kids_tiffin IN (0, 1)),
    suitable_for_adult_tiffin INTEGER NOT NULL DEFAULT 0 CHECK (suitable_for_adult_tiffin IN (0, 1)),
    suitable_for_adult_dinner INTEGER NOT NULL DEFAULT 0 CHECK (suitable_for_adult_dinner IN (0, 1)),
    approved INTEGER NOT NULL DEFAULT 1 CHECK (approved IN (0, 1)),
    cooldown_days INTEGER NOT NULL DEFAULT 21 CHECK (cooldown_days >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recipe_approved ON recipe(approved);
CREATE INDEX IF NOT EXISTS idx_recipe_meal_type ON recipe(meal_type);
CREATE INDEX IF NOT EXISTS idx_recipe_cuisine ON recipe(cuisine);
CREATE INDEX IF NOT EXISTS idx_recipe_kids_tiffin ON recipe(suitable_for_kids_tiffin);
CREATE INDEX IF NOT EXISTS idx_recipe_adult_tiffin ON recipe(suitable_for_adult_tiffin);
CREATE INDEX IF NOT EXISTS idx_recipe_adult_dinner ON recipe(suitable_for_adult_dinner);

-- ============================================================
-- RECIPE <-> ITEM junction. role distinguishes hard requirements from
-- nice-to-haves so eligibility matching can be "all REQUIRED present."
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_item (
    recipe_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('REQUIRED', 'OPTIONAL')),
    PRIMARY KEY (recipe_id, item_id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item(id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_item_item ON recipe_item(item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_item_role ON recipe_item(role);

-- ============================================================
-- FESTIVAL master data + per-year dates (kept separate so a recurring
-- lunar festival doesn't need a new row hardcoded every single year
-- anywhere except the dates table).
-- ============================================================
CREATE TABLE IF NOT EXISTS festival (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_festival_active ON festival(active);

CREATE TABLE IF NOT EXISTS festival_recipe (
    festival_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    family_preference INTEGER NOT NULL DEFAULT 0 CHECK (family_preference IN (0, 1)),
    PRIMARY KEY (festival_id, recipe_id),
    FOREIGN KEY (festival_id) REFERENCES festival(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);
CREATE INDEX IF NOT EXISTS idx_festival_recipe_recipe ON festival_recipe(recipe_id);
CREATE INDEX IF NOT EXISTS idx_festival_recipe_preference ON festival_recipe(family_preference);

-- calendar_date holds the actual per-year dates, one row per date
-- (festival_id nullable so ordinary dietary-restriction days, e.g. a
-- weekly fasting day, don't need a fake festival row).
CREATE TABLE IF NOT EXISTS calendar_date (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_date TEXT NOT NULL,
    festival_id INTEGER,
    lunar_date TEXT,
    dietary_restriction TEXT NOT NULL DEFAULT 'none' CHECK (dietary_restriction IN ('strict_veg', 'no_onion_garlic', 'fasting', 'none')),
    notes TEXT,
    FOREIGN KEY (festival_id) REFERENCES festival(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_date_festival ON calendar_date(calendar_date, festival_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date_date ON calendar_date(calendar_date);
CREATE INDEX IF NOT EXISTS idx_calendar_date_festival ON calendar_date(festival_id);

-- ============================================================
-- GUEST SCHEDULE (placeholder; check_guest_calendar() reads this)
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_date TEXT NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 1,
    dietary_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_guest_schedule_date ON guest_schedule(visit_date);

-- ============================================================
-- TIFFIN SCHEDULE (user-editable; recurring weekday defaults + optional
-- one-off date overrides). A row with effective_date = NULL is a standing
-- weekday rule; a row with effective_date set overrides that single date.
-- Overrides are only accepted up to 7 days ahead at the application layer
-- (not enforced here, since "today" is not a fixed value in a CHECK).
-- Lookup order for any date D: (1) exact effective_date match wins,
-- (2) else fall back to the day_of_week default, (3) else treat as 'none'.
-- ============================================================
CREATE TABLE IF NOT EXISTS tiffin_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week TEXT CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    effective_date TEXT,
    tiffin_type TEXT NOT NULL CHECK (tiffin_type IN ('adult_tiffin', 'kids_tiffin', 'none')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((day_of_week IS NULL) != (effective_date IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiffin_schedule_weekday ON tiffin_schedule(day_of_week) WHERE effective_date IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiffin_schedule_date ON tiffin_schedule(effective_date) WHERE effective_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiffin_schedule_date ON tiffin_schedule(effective_date);

-- ============================================================
-- WEEKLY MEAL PLAN (a plan, not proof of cooking)
-- tiffin_kid_slot / tiffin_adult_cycle_day only apply on days where
-- tiffin_schedule resolves to 'kids_tiffin' / 'adult_tiffin' respectively;
-- both are nullable and ignored otherwise.
-- retry_sent_at supports the confirmation-notification retry job so a
-- day already retried once is not retried again.
-- NOTE: column names here are placeholders pending your final naming pass
-- (flagged as open in the previous round) -- rename freely, logic is unaffected.
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_meal_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    meal_date TEXT NOT NULL,
    meal_slot TEXT NOT NULL CHECK (meal_slot IN ('kids_tiffin', 'adult_tiffin', 'dinner', 'weekend_lunch')),
    tiffin_kid_slot TEXT CHECK (tiffin_kid_slot IN ('AM', 'PM')),
    tiffin_adult_cycle_day INTEGER CHECK (tiffin_adult_cycle_day IN (1, 2)),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed_cooked', 'confirmed_skipped', 'other', 'replaced')),
    notified_at TEXT,
    retry_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_date ON weekly_meal_plan(meal_date);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_recipe ON weekly_meal_plan(recipe_id);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_status ON weekly_meal_plan(status);
CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_date_status ON weekly_meal_plan(meal_date, status);

-- ============================================================
-- MEAL CONFIRMATION LOG (authoritative record of what actually happened;
-- this table, not weekly_meal_plan, is what "avoid recent repeats" and
-- inventory-depletion logic should read from). iMessage source dropped
-- for v1 -- app confirmation only.
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_confirmation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    recipe_id INTEGER NOT NULL,
    cooked_date TEXT NOT NULL DEFAULT CURRENT_DATE,
    user_response TEXT NOT NULL CHECK (user_response IN ('yes', 'no', 'other')),
    source TEXT NOT NULL DEFAULT 'push_notification' CHECK (source IN ('push_notification', 'manual')),
    notes TEXT,
    FOREIGN KEY (plan_id) REFERENCES weekly_meal_plan(id),
    FOREIGN KEY (recipe_id) REFERENCES recipe(id)
);
CREATE INDEX IF NOT EXISTS idx_meal_confirmation_recipe_date ON meal_confirmation_log(recipe_id, cooked_date);
CREATE INDEX IF NOT EXISTS idx_meal_confirmation_date ON meal_confirmation_log(cooked_date);
CREATE INDEX IF NOT EXISTS idx_meal_confirmation_response ON meal_confirmation_log(user_response);

-- ============================================================
-- AWAY LOG (vacation / eating out / party days; excluded from
-- cooldown + repeat-window math so a trip doesn't distort planning)
-- ============================================================
CREATE TABLE IF NOT EXISTS away_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    away_date TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL CHECK (reason IN ('vacation', 'eating_out', 'party', 'other')),
    detected_via TEXT NOT NULL DEFAULT 'manual' CHECK (detected_via IN ('manual', 'inferred')),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_away_log_date ON away_log(away_date);

-- Future tables intentionally excluded from this first cut:
-- receipt parsing tables, per-user preferences, quantity/partial-consumption tracking.
