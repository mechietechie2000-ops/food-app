const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webPush = require('web-push');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Database = require('better-sqlite3');

const port = Number(process.env.PORT || 5005);
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : crypto.randomBytes(32).toString('hex'));
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const pushConfigured = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.');
}

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const database = new Database(path.join(dataDir, 'food-app.sqlite'));
database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
database.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
database.pragma('foreign_keys = ON');

if (pushConfigured) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('Push notifications are disabled. Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.');
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

const toUser = ({ id, first_name: firstName, last_name: lastName, email }) => ({
  id,
  firstName,
  lastName,
  email,
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res, next) => {
  const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = database.prepare(
      'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(firstName, lastName, email, passwordHash);
    const user = database.prepare(
      'SELECT id, first_name, last_name, email FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);
    return res.status(201).json({ message: 'Account created. Please sign in.', user: toUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = database.prepare(
      'SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = ?'
    ).get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: '1d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.json({ user: toUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ user: null });
  }

  let session;
  try {
    session = jwt.verify(token, jwtSecret);
  } catch {
    res.clearCookie('token');
    return res.json({ user: null });
  }

  const user = database.prepare(
    'SELECT id, first_name, last_name, email FROM users WHERE id = ?'
  ).get(session.userId);
  if (!user) {
    res.clearCookie('token');
    return res.json({ user: null });
  }
  return res.json({ user: toUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
  res.json({ message: 'Signed out.' });
});

const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in to manage notifications.' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    res.clearCookie('token', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
};

app.get('/api/push/vapidPublicKey', (_req, res) => {
  if (!pushConfigured) {
    return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
  }
  return res.json({ publicKey: vapidPublicKey });
});

app.post('/api/push/subscribe', authenticate, (req, res) => {
  if (!pushConfigured) {
    return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
  }

  const { endpoint, keys } = req.body;
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    typeof keys?.p256dh !== 'string' ||
    typeof keys?.auth !== 'string'
  ) {
    return res.status(400).json({ error: 'A valid browser push subscription is required.' });
  }

  database.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent
  `).run(
    req.user.userId,
    endpoint,
    keys.p256dh,
    keys.auth,
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  );

  return res.status(201).json({ message: 'This device is subscribed to Food App notifications.' });
});

app.post('/api/push/unsubscribe', authenticate, (req, res) => {
  const { endpoint } = req.body;
  if (typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'A push subscription endpoint is required.' });
  }

  database.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
    .run(endpoint, req.user.userId);
  return res.json({ message: 'This device was unsubscribed from Food App notifications.' });
});

app.post('/api/push/test', authenticate, async (req, res, next) => {
  if (!pushConfigured) {
    return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
  }

  const { endpoint } = req.body;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return res.status(400).json({ error: 'A valid push endpoint for this device is required.' });
  }

  const subscription = database.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).get(req.user.userId, endpoint);
  if (!subscription) {
    return res.status(409).json({ error: 'This device subscription was not found. Enable notifications on this device again.' });
  }

  const payload = JSON.stringify({
    title: 'Food App test notification',
    body: 'Push notifications are working on this device.',
    url: '/',
  });

  try {
    await webPush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, payload);
  } catch (error) {
    const statusCode = error.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      database.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
        .run(subscription.endpoint, req.user.userId);
      return res.status(410).json({ error: 'This device subscription expired. Enable notifications on this device again.' });
    }

    console.error('Push service rejected this device notification:', {
      statusCode: statusCode || null,
      response: typeof error.body === 'string' ? error.body.slice(0, 300) : null,
    });
    if (statusCode === 401 || statusCode === 403) {
      return res.status(502).json({
        code: 'PUSH_AUTH_REJECTED',
        error: `The push service rejected this device (HTTP ${statusCode}). Refresh this device's subscription using the current VAPID key.`,
      });
    }
    return next(error);
  }
  return res.json({ sent: 1, failed: 0 });
});

app.use((error, _req, res, _next) => {
  console.error('API request failed:', error);
  res.status(500).json({ error: 'The server could not complete the request.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Food app API listening on http://localhost:${port}`);
});

const shutdown = () => {
  server.close(() => {
    database.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
