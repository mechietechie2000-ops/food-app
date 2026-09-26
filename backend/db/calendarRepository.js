const db = require("./connection"); // Your database connection module

const listEvents = async (start, end) => {
  if (start && end) {
    return db.all(
      "SELECT id, title, start, end, all_day as allDay, category FROM calendar_events WHERE start >= ? AND (end <= ? OR end IS NULL)",
      [start, end],
    );
  }
  return db.all(
    "SELECT id, title, start, end, all_day as allDay, category FROM calendar_events",
  );
};

const addEvent = async (event) => {
  const { id, title, start, end, allDay, category } = event;
  await db.run(
    `INSERT INTO calendar_events (id, title, start, end, all_day, category) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, title, start, end, allDay ? 1 : 0, category || "general"],
  );
  return event;
};

const updateEvent = async (id, event) => {
  const { title, start, end, allDay, category } = event;
  await db.run(
    `UPDATE calendar_events 
     SET title = ?, start = ?, end = ?, all_day = ?, category = ? 
     WHERE id = ?`,
    [title, start, end, allDay ? 1 : 0, category || "general", id],
  );
  return { id, ...event };
};

const deleteEvent = async (id) => {
  await db.run("DELETE FROM calendar_events WHERE id = ?", [id]);
  return { success: true, id };
};

module.exports = {
  listEvents,
  addEvent,
  updateEvent,
  deleteEvent,
};
