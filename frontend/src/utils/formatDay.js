// "Mon, Oct 5" for a 'YYYY-MM-DD' plan date, in the viewer's locale.
export function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
