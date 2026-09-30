// In-process scheduler for the weekly plan and the push workflows.
//
// A single tick runs every minute. Each job decides for itself whether it is
// due, and records a (job, run_key) row in scheduler_run_log first, so:
//   - restarting the server never sends the same push twice, and
//   - a job missed while the server was off runs on the next tick.
// (Section 6.4: a pure timer that "just hopes" is not reliable enough.)
const { rules } = require('./rules');
const { generateWeek } = require('./mealPlanner');
const {
  WEEK_DAYS,
  dateOffset,
  mondayOf,
  localDateString,
  localDateAtTime,
  sqlTimestamp,
} = require('./dates');

const JOB = Object.freeze({
  WEEKLY_GENERATION: 'weekly_generation',
  EVENING_CONFIRMATION: 'evening_confirmation',
  SOAK_WARNING: 'soak_warning',
});
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_HOUR = 3600000;
const SLOT_LABELS = Object.freeze({
  kids_tiffin: 'kids tiffin',
  adult_tiffin: 'adult tiffin',
  weekend_lunch: 'lunch',
  dinner: 'dinner',
});
const MAX_NAMES_IN_MESSAGE = 2;

function joinNames(names) {
  const shown = names.slice(0, MAX_NAMES_IN_MESSAGE).join(', ');
  const hidden = names.length - MAX_NAMES_IN_MESSAGE;
  return hidden > 0 ? `${shown} and ${hidden} more` : shown;
}

function createScheduler({ database, sendPushToAll, pushConfigured, logger = console }) {
  const schedule = rules.schedule;
  let timer = null;
  let isTickRunning = false;

  // Claim a run so it only ever happens once per key. Returns false when
  // this (job, key) already ran.
  function claimRun(job, runKey, now) {
    const claimed = database.prepare(`
      INSERT OR IGNORE INTO scheduler_run_log (job, run_key, ran_at) VALUES (?, ?, ?)
    `).run(job, runKey, sqlTimestamp(now));
    return claimed.changes === 1;
  }

  function releaseRun(job, runKey) {
    database.prepare('DELETE FROM scheduler_run_log WHERE job = ? AND run_key = ?').run(job, runKey);
  }

  function isPastTime(now, date, time) {
    return now >= localDateAtTime(date, time);
  }

  // --- Section 5: weekly plan publishing ---------------------------------
  // The plan for a week is generated the evening before it starts. The
  // current week is also checked, so a missed Sunday run is made up for.
  function runWeeklyGeneration(now) {
    if (!schedule.weekly_generation_enabled) return;
    const today = localDateString(now);
    const thisWeekStart = mondayOf(today);

    [thisWeekStart, dateOffset(thisWeekStart, WEEK_DAYS)].forEach((weekStart) => {
      const dueOn = dateOffset(weekStart, -1);
      if (!isPastTime(now, dueOn, schedule.weekly_generation_time)) return;
      if (!claimRun(JOB.WEEKLY_GENERATION, weekStart, now)) return;
      try {
        const summary = generateWeek(database, weekStart, { today });
        logger.log(`Weekly plan for ${weekStart}: ${summary.created} planned, `
          + `${summary.alreadyPlanned} slots already had a plan, ${summary.unfilled.length} left empty.`);
      } catch (error) {
        releaseRun(JOB.WEEKLY_GENERATION, weekStart); // try again next tick
        logger.error(`Weekly plan generation for ${weekStart} failed:`, error);
      }
    });
  }

  // --- Section 6.1: evening confirmation push ----------------------------
  // One push per evening listing today's unanswered plan rows. Sending sets
  // notified_at, which arms the retry job below.
  async function runEveningConfirmation(now) {
    if (!pushConfigured) return;
    const today = localDateString(now);
    if (!isPastTime(now, today, schedule.evening_confirmation_time)) return;
    if (!claimRun(JOB.EVENING_CONFIRMATION, today, now)) return;

    const rows = database.prepare(`
      SELECT p.id, r.name AS recipeName
      FROM weekly_meal_plan p
      JOIN recipe r ON r.id = p.recipe_id
      WHERE p.meal_date = ? AND p.status = 'planned' AND p.notified_at IS NULL
      ORDER BY p.meal_slot, p.id
    `).all(today);
    if (rows.length === 0) return;

    const names = rows.map((row) => row.recipeName);
    const result = await sendPushToAll({
      title: 'Did you cook today?',
      body: names.length === 1
        ? `Did you cook ${names[0]}? Tap to confirm.`
        : `Did you cook ${joinNames(names)}? Tap to confirm.`,
      url: '/',
      tag: `meal-confirmation-${today}`,
    });
    // Nobody subscribed means nothing was attempted: leave notified_at empty
    // so the in-app catch-up and digest remain the backstop.
    if (result.attempted === 0) return;
    const markNotified = database.prepare('UPDATE weekly_meal_plan SET notified_at = ? WHERE id = ?');
    database.transaction(() => rows.forEach((row) => markNotified.run(sqlTimestamp(now), row.id)))();
  }

  // --- Section 6.4 step 2: one retry per unanswered row ------------------
  async function runRetry(now) {
    if (!pushConfigured) return;
    const today = localDateString(now);
    const cutoff = sqlTimestamp(new Date(now.getTime() - rules.push_retry_hours * MILLISECONDS_PER_HOUR));
    const rows = database.prepare(`
      SELECT p.id, r.name AS recipeName
      FROM weekly_meal_plan p
      JOIN recipe r ON r.id = p.recipe_id
      WHERE p.status = 'planned'
        AND p.notified_at IS NOT NULL
        AND p.notified_at <= ?
        AND p.retry_sent_at IS NULL
        AND p.meal_date >= ?
      ORDER BY p.meal_date, p.meal_slot, p.id
    `).all(cutoff, dateOffset(today, -rules.catchup_lookback_days));
    if (rows.length === 0) return;

    // Stamp first so a slow push service can never cause a second retry.
    const markRetried = database.prepare('UPDATE weekly_meal_plan SET retry_sent_at = ? WHERE id = ?');
    database.transaction(() => rows.forEach((row) => markRetried.run(sqlTimestamp(now), row.id)))();

    const names = rows.map((row) => row.recipeName);
    await sendPushToAll({
      title: 'Still need your answer',
      body: `You haven't confirmed ${joinNames(names)} yet. Tap to update the app.`,
      url: '/',
      tag: `meal-confirmation-retry-${today}`,
    });
  }

  // --- Section 6.3: soak / marination early warning ----------------------
  async function runSoakWarning(now) {
    if (!pushConfigured) return;
    const today = localDateString(now);
    if (!isPastTime(now, today, schedule.soak_warning_time)) return;
    if (!claimRun(JOB.SOAK_WARNING, today, now)) return;

    const tomorrow = dateOffset(today, 1);
    const meals = database.prepare(`
      SELECT r.name AS recipeName, p.meal_slot AS mealSlot
      FROM recipe r
      JOIN weekly_meal_plan p ON p.recipe_id = r.id
      WHERE r.requires_soak_marination = 1
        AND p.meal_date = ?
        AND p.status = 'planned'
      ORDER BY p.meal_slot, p.id
    `).all(tomorrow);
    if (meals.length === 0) return;

    const slotNames = [...new Set(meals.map((meal) => SLOT_LABELS[meal.mealSlot] || meal.mealSlot))];
    await sendPushToAll({
      title: 'Soak tonight',
      body: `Tomorrow's ${slotNames.join(' and ')} requires soaking (${joinNames(meals.map((meal) => meal.recipeName))}). Start soaking tonight!`,
      url: '/',
      tag: `soak-warning-${tomorrow}`,
    });
  }

  // One pass over every job. `now` is injectable so tests can move the clock.
  async function tick(now = new Date()) {
    if (isTickRunning) return;
    isTickRunning = true;
    try {
      runWeeklyGeneration(now);
      // Generate first: a fresh plan may contain today's rows to notify about.
      await runEveningConfirmation(now);
      await runRetry(now);
      await runSoakWarning(now);
    } catch (error) {
      logger.error('Scheduler tick failed:', error);
    } finally {
      isTickRunning = false;
    }
  }

  function start() {
    if (timer) return;
    tick();
    timer = setInterval(() => tick(), schedule.tick_seconds * MILLISECONDS_PER_SECOND);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, tick };
}

module.exports = { createScheduler };
