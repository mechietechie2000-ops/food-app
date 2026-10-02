// Shared meal-slot and meal-type names, so the planner, API, scheduler and
// catch-up code all agree on them.
//
// meal_slot (weekly_meal_plan.meal_slot) is validated here and in the API, not
// by a database CHECK (see migrations/001_weekly_meal_plan_drop_slot_check.sql).
const SLOT = Object.freeze({
  KIDS_TIFFIN: 'kids_tiffin',
  ADULT_TIFFIN: 'adult_tiffin',
  WEEKEND_LUNCH: 'weekend_lunch',
  DINNER: 'dinner',
  BREAKFAST: 'breakfast',
  SIDES: 'sides',
  GUEST_SPECIAL: 'guest_special',
});

const MEAL_SLOTS = Object.freeze(Object.values(SLOT));

// Slots that are never confirmed, never nag through push / catch-up, and never
// consume inventory. They are plain "what is planned" rows.
const UNCONFIRMED_SLOTS = Object.freeze([SLOT.BREAKFAST, SLOT.SIDES, SLOT.GUEST_SPECIAL]);

const MEAL_TYPE = Object.freeze({
  DAL_SIDE: 'dal_side',
  BREAKFAST: 'breakfast',
  PROTEIN_SIDE: 'protein_side',
  WEEKEND_SIDE: 'weekend_side',
});

// recipe.meal_type values that are never a main dish, so they are kept out of
// the automatic planner and out of the main-dish slots.
const NON_MAIN_MEAL_TYPES = Object.freeze(Object.values(MEAL_TYPE));
const SIDES_SLOT_MEAL_TYPES = Object.freeze([MEAL_TYPE.PROTEIN_SIDE, MEAL_TYPE.WEEKEND_SIDE]);

const sqlList = (values) => values.map(() => '?').join(', ');

module.exports = {
  SLOT,
  MEAL_SLOTS,
  UNCONFIRMED_SLOTS,
  MEAL_TYPE,
  NON_MAIN_MEAL_TYPES,
  SIDES_SLOT_MEAL_TYPES,
  sqlList,
};
