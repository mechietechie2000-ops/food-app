// Sends one payload to every subscribed device of the household.
// Food data is household-wide (not per user), so scheduled reminders go to
// every subscription. Dead subscriptions (HTTP 404/410) are pruned.
const NO_LONGER_VALID_STATUS_CODES = [404, 410];

function createPushSender({ database, webPush, pushConfigured }) {
  async function sendPushToAll(payload) {
    const result = { attempted: 0, sent: 0, failed: 0 };
    if (!pushConfigured) return result;

    const subscriptions = database.prepare(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions',
    ).all();
    result.attempted = subscriptions.length;

    const outcomes = await Promise.allSettled(subscriptions.map((subscription) => webPush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
    )));
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        result.sent += 1;
        return;
      }
      result.failed += 1;
      if (NO_LONGER_VALID_STATUS_CODES.includes(outcome.reason?.statusCode)) {
        database.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
          .run(subscriptions[index].endpoint);
      }
    });
    return result;
  }

  return { sendPushToAll };
}

module.exports = { createPushSender };
