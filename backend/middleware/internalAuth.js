// Auth for machine-to-machine calls (launchd's curl, cron jobs) that have no
// browser session/JWT cookie. Separate from middleware/auth.js on purpose —
// this is a single shared secret, not a per-user credential.
//
// Set CRON_SECRET in backend/.env. If it's unset, this middleware refuses
// every request rather than silently allowing an unauthenticated reset.
const authenticateInternal = (req, res, next) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "CRON_SECRET is not configured on the server." });
  }
  const provided = req.headers["x-internal-key"];
  if (provided !== expected) {
    return res.status(401).json({ error: "Invalid or missing internal key." });
  }
  next();
};

module.exports = { authenticateInternal };
