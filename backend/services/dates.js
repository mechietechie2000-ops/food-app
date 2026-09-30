// Small date helpers shared by the planner, scheduler and routes.
// Plan dates are plain 'YYYY-MM-DD' strings. Calendar math on them is done in
// UTC so daylight-saving shifts can never move a date.
const DAY_MILLISECONDS = 86400000;
const WEEK_DAYS = 7;
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

function isDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function dateOffset(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MILLISECONDS);
}

function weekdayIndex(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function weekdayName(date) {
  return WEEKDAY_NAMES[weekdayIndex(date)];
}

function isWeekend(date) {
  const index = weekdayIndex(date);
  return index === SATURDAY || index === SUNDAY;
}

function isMonday(date) {
  return weekdayIndex(date) === MONDAY;
}

// Monday of the week that contains `date` (weeks run Monday to Sunday).
function mondayOf(date) {
  const daysSinceMonday = (weekdayIndex(date) + 6) % WEEK_DAYS;
  return dateOffset(date, -daysSinceMonday);
}

// The server's local calendar date (the household's date, not UTC's).
function localDateString(now) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Local Date for a plan date at 'HH:MM'.
function localDateAtTime(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

// UTC timestamp in the same 'YYYY-MM-DD HH:MM:SS' shape SQLite's
// CURRENT_TIMESTAMP produces, so string comparison in SQL stays correct.
function sqlTimestamp(now) {
  return now.toISOString().replace('T', ' ').slice(0, 19);
}

module.exports = {
  DAY_MILLISECONDS,
  WEEK_DAYS,
  isDate,
  dateOffset,
  daysBetween,
  weekdayIndex,
  weekdayName,
  isWeekend,
  isMonday,
  mondayOf,
  localDateString,
  localDateAtTime,
  sqlTimestamp,
};
