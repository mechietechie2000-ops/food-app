const db = require("./connection");

async function saveSubscription(userId, subscription, userAgent) {
  const { endpoint, keys } = subscription;
  return db.run(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       user_agent = excluded.user_agent`,
    [userId, endpoint, keys.p256dh, keys.auth, userAgent]
  );
}

async function removeSubscription(endpoint) {
  return db.run(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
}

async function getSubscriptionsForUser(userId) {
  return db.all(`SELECT * FROM push_subscriptions WHERE user_id = ?`, [userId]);
}

async function getAllSubscriptions() {
  return db.all(`SELECT * FROM push_subscriptions`);
}

module.exports = {
  saveSubscription,
  removeSubscription,
  getSubscriptionsForUser,
  getAllSubscriptions,
};