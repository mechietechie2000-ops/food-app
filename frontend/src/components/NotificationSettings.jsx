import { useState } from 'react';
import { subscribeToPush, unsubscribeFromPush } from '../services/pushService';

const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;

export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(
    hasNotificationApi && Notification.permission === 'granted'
  );
  const [loading, setLoading] = useState(false);

  if (!hasNotificationApi) return null; // unsupported browser, don't render the toggle

  const toggle = async () => {
    setLoading(true);
    try {
      if (!enabled) {
        await subscribeToPush();
        setEnabled(true);
      } else {
        await unsubscribeFromPush();
        setEnabled(false);
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={toggle} disabled={loading}>
      {enabled ? 'Disable' : 'Enable'} Notifications
    </button>
  );
}