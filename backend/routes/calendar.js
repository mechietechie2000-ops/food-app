const express = require("express");
const router = express.Router();
const repo = require("../db/calendarRepository");
const { authenticate } = require("../middleware/auth");

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Secure all calendar routes
router.use(authenticate);

// ---- Calendar CRUD Routes ----

// Get events (Supports filtering: GET /api/calendar?start=2026-08-01&end=2026-08-31)
router.get(
  "/api/calendar",
  handle((req) => repo.listEvents(req.query.start, req.query.end)),
);

// Create event
router.post(
  "/api/calendar",
  handle((req) => repo.addEvent(req.body)),
);

// Update event
router.put(
  "/api/calendar/:id",
  handle((req) => repo.updateEvent(req.params.id, req.body)),
);

// Delete event
router.delete(
  "/api/calendar/:id",
  handle((req) => repo.deleteEvent(req.params.id)),
);

module.exports = router;
