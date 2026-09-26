const express = require('express');
const webpush = require('web-push');
const router = express.Router();
const { authenticate } = require('../middleware/auth');   // was: const auth = require(...)
const pushRepo = require('../db/pushRepository');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

router.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const subscription = req.body;
    const userAgent = req.headers['user-agent'];
    await pushRepo.saveSubscription(req.user.userId, subscription, userAgent); // was req.user.id
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await pushRepo.removeSubscription(endpoint);
    res.status(200).json({ message: 'Unsubscribed' });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

async function sendNotificationToUser(userId, payload) {
  const subs = await pushRepo.getSubscriptionsForUser(userId);
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)) {
      pushRepo.removeSubscription(subs[i].endpoint);
    }
  });

  return results;
}

router.post('/test', authenticate, async (req, res) => {
  await sendNotificationToUser(req.user.userId, {   // was req.user.id
    title: 'Test notification',
    body: 'Push is working 🎉',
    url: '/',
  });
  res.json({ message: 'Sent' });
});

module.exports = { router, sendNotificationToUser };