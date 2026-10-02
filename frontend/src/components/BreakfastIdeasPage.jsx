import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

// "Breakfast Ideas": one line per idea from config/breakfast-ideas.json.
// The checkboxes only mark ideas while this page is open; they are not saved
// yet, so nothing is lost or sent to the server when you tick them.
export default function BreakfastIdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState([]);
  const [weekdays, setWeekdays] = useState([]);
  const [checked, setChecked] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrentRequest = true;
    api.get('/food/breakfast-ideas')
      .then(({ data }) => {
        if (!isCurrentRequest) return;
        setIdeas(data.ideas || []);
        setWeekdays(data.weekdays || []);
      })
      .catch((requestError) => {
        if (isCurrentRequest) setError(requestError.message || 'Could not load the breakfast ideas.');
      })
      .finally(() => {
        if (isCurrentRequest) setLoading(false);
      });
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const toggle = (id) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', display: 'grid', gap: 2 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/settings')}
        sx={{ justifySelf: 'start', textTransform: 'none' }}
      >
        Menu
      </Button>
      <Box>
        <Typography variant="h4">Breakfast Ideas</Typography>
        <Typography color="text.secondary">
          {weekdays.length ? `${weekdays[0]} to ${weekdays[weekdays.length - 1]} mornings` : 'Weekday mornings'}
          , no added sugar. Fruit is fine.
        </Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <CircularProgress size={24} />}
      {!loading && !error && ideas.length === 0 && (
        <Alert severity="info">No breakfast ideas yet. Add some to backend/config/breakfast-ideas.json.</Alert>
      )}
      {ideas.length > 0 && (
        <Card sx={{ py: 0.5 }}>
          {ideas.map((idea) => (
            <Box
              key={idea.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minWidth: 0 }}
            >
              <FormControlLabel
                sx={{ flex: 1, minWidth: 0, my: 0.25, alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 1 } }}
                control={<Checkbox checked={checked.has(idea.id)} onChange={() => toggle(idea.id)} />}
                label={<Typography sx={{ pt: 1, overflowWrap: 'anywhere' }}>{idea.name}</Typography>}
              />
              {idea.overnightPrep && (
                <Chip size="small" variant="outlined" label="Prep the night before" />
              )}
            </Box>
          ))}
        </Card>
      )}
    </Box>
  );
}
