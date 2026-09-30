import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const STATUS_FILTERS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'USED', label: 'Used' },
  { value: 'DISCARDED', label: 'Discarded' },
  { value: 'ALL', label: 'All' },
];
const FRESHNESS_COLORS = { Fresh: 'success', 'Use soon': 'warning', Old: 'error' };

function localDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function expiryText(lot) {
  if (lot.days_until_expiry === null) return formatDate(lot.expiry_date);
  if (lot.days_until_expiry < 0) return `${formatDate(lot.expiry_date)} (${-lot.days_until_expiry}d ago)`;
  if (lot.days_until_expiry === 0) return `${formatDate(lot.expiry_date)} (today)`;
  return `${formatDate(lot.expiry_date)} (in ${lot.days_until_expiry}d)`;
}

// "Show Current Inventory": rows straight from the inventory table, one row
// per purchase lot (two Bhindi purchases stay two rows).
export default function InventoryPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('AVAILABLE');
  const [loaded, setLoaded] = useState({ status: null, lots: [], error: '' });

  useEffect(() => {
    let isCurrentRequest = true;
    api.get(`/food/inventory?status=${status}&today=${encodeURIComponent(localDate(new Date()))}`)
      .then(({ data }) => {
        if (isCurrentRequest) setLoaded({ status, lots: data.lots, error: '' });
      })
      .catch((error) => {
        if (isCurrentRequest) {
          setLoaded({ status, lots: [], error: error.message || 'Could not load the inventory.' });
        }
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [status]);

  const isLoading = loaded.status !== status;
  const showFreshness = status === 'AVAILABLE';

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h4">Current inventory</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/settings')}>
          Back to menu
        </Button>
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        onChange={(_event, next) => next && setStatus(next)}
        aria-label="Inventory status filter"
        sx={{ flexWrap: 'wrap' }}
      >
        {STATUS_FILTERS.map((filter) => (
          <ToggleButton key={filter.value} value={filter.value} sx={{ textTransform: 'none', px: 2 }}>
            {filter.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {loaded.error && !isLoading && <Alert severity="error">{loaded.error}</Alert>}
      {isLoading && <CircularProgress size={24} />}

      {!isLoading && !loaded.error && (
        <Card>
          {loaded.lots.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No {status === 'ALL' ? '' : `${status.toLowerCase()} `}inventory lots.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" aria-label="Inventory lots">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Purchased</TableCell>
                    <TableCell>{status === 'USED' ? 'Used' : 'Expires'}</TableCell>
                    <TableCell>Store</TableCell>
                    <TableCell>{showFreshness ? 'Freshness' : 'Status'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loaded.lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{lot.item_name}</TableCell>
                      <TableCell>{formatDate(lot.purchase_date)}</TableCell>
                      <TableCell>
                        {status === 'USED' ? formatDate(lot.used_date) : expiryText(lot)}
                      </TableCell>
                      <TableCell>{lot.store || '—'}</TableCell>
                      <TableCell>
                        {lot.freshness && showFreshness ? (
                          <Chip size="small" color={FRESHNESS_COLORS[lot.freshness]} label={lot.freshness} />
                        ) : (
                          <Chip size="small" variant="outlined" label={lot.status.toLowerCase()} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}
    </Box>
  );
}
