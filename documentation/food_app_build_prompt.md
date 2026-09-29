# Food App (PWA) — Build Prompt / Technical Spec (v1)

## 0. Role & Objective

You are building a lightweight Progressive Web App (PWA) that helps a household:
1. Track grocery inventory (via input form now, receipt-parsing later).
2. Decide what to cook based on inventory freshness, festivals, weekday/weekend rules, and repeat-avoidance.
3. Publish a weekly meal plan.
4. Confirm via push notification what was actually cooked, and keep inventory in sync with reality (not just the plan).

Follow the coding rules in Section 8 exactly — they govern file structure, style, and portability. Companion file: `food_app_schema_merged.sql`.

---

## 1. Data Model

Full DDL lives in `food_app_schema_merged.sql`. Summary of tables and key decisions:

- **item** — master list for grocery form + inventory. `category` (green_veggie/staple/dal/spice/protein/other) drives the two-column checkbox UI. `is_veg`, `default_shelf_life_days`.
- **grocery_stage** — intake from form (or future receipt parser). Rows are *pending*, not purchases, until confirmed.
- **inventory** — one row per purchased lot. No quantity tracking anywhere (house rule: an item is either `AVAILABLE`, `USED`, or `DISCARDED` — never partial).
- **recipe** — includes `is_veg`, `is_frozen_friendly`, `requires_soak_marination`, `cooldown_days`, and suitability flags `suitable_for_kids_tiffin` / `suitable_for_adult_tiffin` / `suitable_for_adult_dinner`.
- **recipe_item** — junction with `role` (REQUIRED/OPTIONAL).
- **festival** / **festival_recipe** / **calendar_date** — recurring festival master data separated from per-year dates, so a lunar festival doesn't need a new hardcoded row every year. `calendar_date.dietary_restriction` (strict_veg/no_onion_garlic/fasting/none).
- **guest_schedule** — placeholder table; `check_guest_calendar()` reads from it (stub logic for now).
- **tiffin_schedule** — see Section 4a below. Replaces any fixed weekday assumption.
- **weekly_meal_plan** — the *plan*, not proof of cooking. Includes `tiffin_kid_slot` (AM/PM), `tiffin_adult_cycle_day` (1/2), `retry_sent_at` (see Section 6.4).
- **meal_confirmation_log** — the *authoritative* record of what was actually cooked. `source` is `push_notification` or `manual` only (iMessage path dropped — Section 2.2).
- **away_log** — vacation/eating-out/party days, excluded from cooldown and repeat-window math.

**Open item**: `weekly_meal_plan` column names are placeholders pending a final naming pass — rename freely in the schema file; nothing in this spec depends on the specific names, only on what each column represents.

---

## 2. Grocery Input Form (Frontend)

- Two labeled sections:
  - **Green Veggies** — checkbox list, 2-column grid layout.
  - **Staples** — dals / other staples, checkbox list, 2-column grid layout.
- Checkbox item lists come from `config/ui_form_categories.json`, not hardcoded, so adding/removing items doesn't touch code.
- On submit: POST form data → writes rows into `grocery_stage`.

### 2.1 Post-submit flow
- A second user opens a UI backed by `grocery_stage` in read/write mode, checks off what was actually bought.
- (iMessage text-list path is **dropped for v1** — app-based confirmation only. Do not build the "generate text list and send via Messages" flow.)

### 2.2 Purchase confirmation
- User opens the app, sees `grocery_stage` in checkbox mode, confirms what was actually purchased.
- On confirmation: rows move from `grocery_stage` into `inventory`, with `purchase_date = confirmation timestamp` and `expiry_date = purchase_date + item.default_shelf_life_days`.

---

## 3. Receipt Input Path (Do Not Build Yet)
- Placeholder only: a `parse_receipt()` function stub with a comment `# TODO: LLM-based receipt parsing — not implemented in v1`.
- No OCR/LLM integration in this pass.

---

## 4. Meal Decision Flow

Implement as a single ordered pipeline function, e.g. `decide_meal(date, meal_slot)`, applying these checks in order:

1. **Check inventory** — required ingredients (`recipe_item` role=REQUIRED) for a candidate recipe must be present and `AVAILABLE`.
2. **Check `cooldown_days`** — exclude recipes cooked within their cooldown window (`meal_confirmation_log.cooked_date` vs today, `user_response = 'yes'` only).
3. **Check calendar/festival** — query `calendar_date`/`festival_recipe` for the target date; if a festival is active, restrict candidates to that festival's recipes first, and respect `dietary_restriction` (e.g. exclude non-veg or onion/garlic recipes on a fasting day).
4. **Weekend + no festival** → prioritize non-veg recipes (`is_veg = 0`) and frozen-friendly recipes (`is_frozen_friendly = 1`) as candidates.
5. **Weekend soak/marination early-warning** — see cron job in Section 6.3.
6. **Guest check** — call `check_guest_calendar()` (stub for now; returns no-op until built out).
7. **Meal-slot-specific rules**:
   - **Dinner (weekday, adults)**: green veggies, daliya/daal, quinoa, similar — filter `suitable_for_adult_dinner = 1`.
   - **Tiffin**: resolved entirely by `tiffin_schedule`, not a fixed weekday list — see Section 4a.
8. **Avoid recent repeats** — exclude anything in `meal_confirmation_log` (`user_response = 'yes'`) within a configurable lookback window (`config/rules.json`), excluding any dates present in `away_log` from that window's math.
9. **Freshness / use-soon priority** — rank remaining candidates by how close their required inventory items are to `expiry_date` (soonest-expiring first).
10. Return the top-ranked recipe (or top N for the UI to choose from).

### 4a. Tiffin scheduling (replaces any fixed weekday assumption)

Tiffin days are **not hardcoded** — they're user-editable via the `tiffin_schedule` table, because the household wants to plan ahead and change specific days when needed.

For a given date `D`, resolve the tiffin type like this:
1. Look for a row in `tiffin_schedule` where `effective_date = D` (a one-off override). If found, use its `tiffin_type` — this always wins.
2. Otherwise, look for a row where `day_of_week = weekday_name(D)` (the standing default, e.g. "Monday → adult_tiffin"). Use its `tiffin_type`.
3. If neither exists, treat the day as `tiffin_type = 'none'` — skip tiffin planning entirely for that date.

Based on the resolved type:
- **`adult_tiffin`**: run the adult-tiffin filter only — `suitable_for_adult_tiffin = 1`, no Indian food (`cuisine != 'Indian'`), only rolls/rice + sides. Write one `weekly_meal_plan` row with `meal_slot = 'adult_tiffin'` and `tiffin_adult_cycle_day` set (e.g. Monday = 1, Tuesday = 2, derived from weekday at write time).
- **`kids_tiffin`**: run `decide_meal()` **twice** for that date — once for slot `AM`, once for `PM`. Each call filters `suitable_for_kids_tiffin = 1` and applies cooldown/repeat rules independently, but the second call also excludes whatever recipe the first call just picked (so AM and PM aren't identical). Write two `weekly_meal_plan` rows, `tiffin_kid_slot = 'AM'` and `'PM'`.
- **`none`**: no tiffin row generated for that date at all.

**Editing overrides**: users can set a one-off override for any date up to **7 days ahead** (enforced in the application layer, not the DB — validate `effective_date` is within `today` → `today + 7` before insert/update). Overrides beyond that window should be rejected with a clear message.

**Interaction with an already-published week**: if a user edits/adds an override for a date that already has `weekly_meal_plan` rows generated:
- Mark the existing rows for that date `status = 'replaced'`.
- Regenerate just that date's tiffin row(s) using the new override (a "regenerate single date" function, not a full week re-publish).
- Do not silently leave stale rows in `'planned'` status — that would confuse the evening confirmation job and the soak/marination cron.

---

## 5. Weekly Meal Plan Publishing
- Reuse the existing UI card component (already built).
- `decide_meal()` runs once per slot for the week (dinner every day; tiffin only on dates that resolve to `adult_tiffin`/`kids_tiffin` per Section 4a; weekend_lunch on Sat/Sun) and writes results into `weekly_meal_plan` with `status = 'planned'`.
- The existing card UI reads from `weekly_meal_plan`, not a live recomputation — so the plan is stable once published.

---

## 6. Inventory Truth & Consumption Tracking

**Core problem**: the weekly plan is a *plan*, not a *fact*. Inventory must be updated based on actual behavior, not intent.

### 6.1 Evening confirmation push notification
- Server-scheduled push notification each evening asking "Did you cook [recipe]?"
- Response options: **Yes / No / Other**. Confirmation is app-only — there is no iMessage reply path in v1.
- On **Yes**: mark `weekly_meal_plan.status = 'confirmed_cooked'`; mark all `REQUIRED` ingredients for that recipe in `inventory` as `status = 'USED'` (full-item consumption assumption, Section 6.2). Insert a row into `meal_confirmation_log` (`source = 'push_notification'`).
- On **No**: mark `status = 'confirmed_skipped'`; do not touch inventory. Log to `meal_confirmation_log` for analysis and for Section 7's away-day inference.
- On **Other**: log response as `'other'`; no automatic inventory change.

### 6.2 Unit/consumption assumption
- Confirmed rule: assume the entire item is used per recipe — no partial-quantity tracking. On "Yes," simply flip `inventory.status` to `USED` for the relevant lots.

### 6.3 Daily cron: soak/marination early warning
- Cron job at 8:00 PM daily, for next day's planned meals:
  ```sql
  SELECT * FROM recipe
  WHERE requires_soak_marination = 1
    AND id IN (
      SELECT recipe_id FROM weekly_meal_plan
      WHERE meal_date = CURRENT_DATE + 1
    );
  ```
- If any rows returned → push notification: *"Tomorrow's lunch requires soaking. Start soaking tonight!"*

### 6.4 Retry & catch-up logic (replaces "just hope the push arrives")

Config additions to `config/rules.json`:
```json
"push_retry_hours": 3,
"catchup_lookback_days": 7
```

Layered fallback, since a single push notification can be lost:
1. **Primary**: evening push notification (Section 6.1), sets `weekly_meal_plan.notified_at`.
2. **Retry**: a scheduled job checks for `weekly_meal_plan` rows where `status = 'planned'`, `notified_at` is more than `push_retry_hours` old, and `retry_sent_at IS NULL`. Send one follow-up push, then set `retry_sent_at` so the row is never retried twice.
3. **Catch-up on next app open**: whenever the user opens the app, query for `weekly_meal_plan` rows with `status = 'planned'` and `meal_date < today` (within `catchup_lookback_days`). Surface a lightweight catch-up screen: *"You haven't confirmed the last N days — what happened?"* with quick multi-select (cooked/skipped/away), writing results into `meal_confirmation_log` same as the push flow.
4. **Passive daily digest**: independent of push reliability, always show any unconfirmed days from the last `catchup_lookback_days` on a "morning summary" screen, so nothing silently falls through — the app itself is the backstop, not just the notification.

---

## 7. Away Days (vacation / eating out / parties)

- `away_log` table: `away_date`, `reason` (vacation/eating_out/party/other), `detected_via` (manual/inferred).
- **Manual**: simple "Mark days away" control (date range + reason) in the app.
- **Inferred**: if the evening confirmation is answered "No" for 2+ consecutive days, prompt: *"Looks like you haven't been cooking — away, eating out, or something else?"* and log the answer.
- **Effect on planning**: `decide_meal()`'s repeat-avoidance and cooldown math (Section 4, step 8) should exclude any date present in `away_log` from the lookback window, so a multi-day trip doesn't distort "avoid recent repeats" calculations.

---

## 8. Coding Rules (must follow)

1. All table/index DDL lives in a single SQL file: `food_app_schema_merged.sql`.
2. No empty lines inside a single `CREATE TABLE` statement's column list.
3. Code should be function/variable-driven — no magic numbers/strings inline; name things clearly.
4. Use configuration files wherever possible for portability:
   - `config/ui_form_categories.json` — checkbox items for Green Veggies / Staples sections.
   - `config/rules.json` — default cooldown days, repeat-avoidance lookback window, `push_retry_hours`, `catchup_lookback_days`.
   - Note: the tiffin day mapping is **not** in config — it's the `tiffin_schedule` table, since it's user-editable data the household changes week to week, not a static constant.
5. Prefer JSON config files over DB rows for static/UI-state data; reserve the database for transactional/historical data.
6. Human-readable code; keep logic simple — don't compress it.
7. Add proper comments throughout, especially on the meal-decision pipeline and confirmation flows.

---

## 9. Suggested Build Order

1. `food_app_schema_merged.sql` — all tables.
2. `config/ui_form_categories.json` + `config/rules.json`.
3. Grocery input form (Section 2) → `grocery_stage` → confirmation screen → `inventory`.
4. Receipt path: stub function only (Section 3).
5. `decide_meal()` pipeline (Section 4/4a) with `check_guest_calendar()` stubbed.
6. `tiffin_schedule` admin screens: weekday-defaults editor + one-off override picker (7-day-ahead cap enforced client- and server-side).
7. Weekly plan publishing into `weekly_meal_plan`, wired to the existing UI card, including the "regenerate single date" path for post-publish overrides (Section 4a).
8. Evening confirmation push notification + inventory update logic (Section 6.1–6.2).
9. Daily 8 PM soak/marination cron (Section 6.3).
10. Retry job + catch-up screen + passive digest (Section 6.4).
11. `away_log` manual + inferred logging (Section 7).

---

## 10. Open Decisions to Confirm Before Coding
- Final column names for `weekly_meal_plan` (flagged as pending — schema currently uses placeholder names; rename freely, nothing else depends on the specific strings).
- Confirm whether editing an override on an already-published date should **block** the edit or **auto-regenerate** that date's plan (spec currently assumes auto-regenerate with `status = 'replaced'` on the stale rows — confirm this is the desired behavior).
- Confirm default weekday tiffin pattern to seed `tiffin_schedule` with initially (e.g. Mon/Tue = adult_tiffin, Wed/Fri = kids_tiffin, Thu/weekend = none, per earlier discussion) — needs to be seeded once at setup, not hardcoded in code.
