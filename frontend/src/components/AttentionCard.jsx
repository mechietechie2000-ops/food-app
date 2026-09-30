import { Alert, Box, Button } from '@mui/material';
import { formatDay } from '../utils/formatDay';

// Home-screen "morning summary" (spec 6.4 step 4). It is built from the app's
// own data, not from push delivery, so unanswered items can never silently
// fall through even when a notification is lost.
export default function AttentionCard({ unconfirmed, lookbackDays, pendingPurchaseCount, onReview, onConfirmPurchases }) {
  const days = [...new Set(unconfirmed.map((meal) => meal.meal_date))];
  if (days.length === 0 && pendingPurchaseCount === 0) return null;

  return (
    <Box sx={{ display: 'grid', gap: 1, mb: 2 }} aria-label="Needs your attention">
      {days.length > 0 && (
        <Alert
          severity="warning"
          action={<Button color="inherit" size="small" onClick={onReview}>Review</Button>}
        >
          {unconfirmed.length} {unconfirmed.length === 1 ? 'meal' : 'meals'} from the last {lookbackDays} days
          {' '}still {unconfirmed.length === 1 ? 'needs' : 'need'} an answer ({days.map(formatDay).join(', ')}).
        </Alert>
      )}
      {pendingPurchaseCount > 0 && (
        <Alert
          severity="info"
          action={<Button color="inherit" size="small" onClick={onConfirmPurchases}>Confirm</Button>}
        >
          {pendingPurchaseCount} {pendingPurchaseCount === 1 ? 'vegetable is' : 'vegetables are'} on the
          grocery list waiting for purchase confirmation.
        </Alert>
      )}
    </Box>
  );
}
