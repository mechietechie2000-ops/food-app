import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import {
  refreshPushSubscription,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from '../services/pushService';

const isPushSupported = typeof window !== 'undefined'
  && 'Notification' in window
  && 'PushManager' in window
  && 'serviceWorker' in navigator;

export default function PushNotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(isPushSupported);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canRefreshSubscription, setCanRefreshSubscription] = useState(false);

  useEffect(() => {
    if (!isPushSupported) {
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch((subscriptionError) => setError(subscriptionError.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleSubscription = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setCanRefreshSubscription(false);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
        setMessage('Notifications are disabled for this device.');
      } else {
        await subscribeToPush();
        setEnabled(true);
        setMessage('This device is subscribed to Food App notifications.');
      }
    } catch (subscriptionError) {
      setError(subscriptionError.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setSending(true);
    setError('');
    setMessage('');
    setCanRefreshSubscription(false);
    try {
      const result = await sendTestPush();
      setMessage(`Push service accepted the test for this device. This confirms dispatch, not that the device displayed it. (Accepted: ${result.sent}; failed: ${result.failed}.)`);
    } catch (sendError) {
      setError(sendError.message);
      setCanRefreshSubscription(sendError.code === 'PUSH_AUTH_REJECTED');
    } finally {
      setSending(false);
    }
  };

  const refreshSubscription = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await refreshPushSubscription();
      setEnabled(true);
      setCanRefreshSubscription(false);
      setMessage('This device is now subscribed with the current Food App push key. Send another test.');
    } catch (refreshError) {
      setError(refreshError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Push notification test</Typography>
        {!isPushSupported ? (
          <Alert severity="warning">
            This browser does not support web push. Use an up-to-date browser over HTTPS.
          </Alert>
        ) : (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {enabled ? 'This device is subscribed.' : 'Enable notifications on this device, then send a test.'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={toggleSubscription}
                disabled={loading || sending}
                sx={{
                  color: '#102018',
                  '&:hover': { backgroundColor: '#3da58a' },
                }}
              >
                {loading ? 'Checking…' : enabled ? 'Disable notifications' : 'Enable notifications'}
              </Button>
              <Button
                variant="contained"
                onClick={sendTestNotification}
                disabled={!enabled || loading || sending}
                sx={{
                  backgroundColor: '#356ae6',
                  color: '#fff',
                  '&:hover': { backgroundColor: '#2454c6' },
                }}
              >
                {sending ? 'Sending…' : 'Send test notification'}
              </Button>
            </Box>
            {message && <Alert severity={message.includes('could not be reached') ? 'warning' : 'info'} sx={{ mt: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {canRefreshSubscription && (
              <Button
                variant="outlined"
                onClick={refreshSubscription}
                disabled={loading || sending}
                sx={{ mt: 2, display: 'block' }}
              >
                Refresh this device subscription
              </Button>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              The test targets only this device. iPhone/iPad: install Food App from Safari using Add to Home Screen before enabling push. If a test is accepted but not shown, check Notification Center and Focus settings.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
