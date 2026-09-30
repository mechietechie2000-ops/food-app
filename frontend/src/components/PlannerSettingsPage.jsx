import { useContext, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { ColorModeContext } from '../theme';
import { useAuth } from '../context/useAuth';
import PushNotificationSettings from './PushNotificationSettings';

export default function PlannerSettingsPage({ onGeneratePlan }) {
  const { preference, setColorMode } = useContext(ColorModeContext);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [planMessage, setPlanMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  const signOut = async () => {
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (signOutError) {
      setError(signOutError.message || 'Could not sign out.');
    }
  };

  const generatePlan = async () => {
    setError('');
    setPlanMessage('');
    setGenerating(true);
    try {
      const result = await onGeneratePlan();
      setPlanMessage(
        `Added ${result.created} planned ${result.created === 1 ? 'meal' : 'meals'}`
        + `${result.alreadyPlanned ? `; ${result.alreadyPlanned} slots already had a plan` : ''}`
        + `${result.unfilled.length ? `; ${result.unfilled.length} slots have no recipe that fits the current inventory` : ''}.`,
      );
    } catch (generateError) {
      setError(generateError.message || 'Could not generate the weekly plan.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', display: 'grid', gap: 2 }}>
      <Typography variant="h4">Menu</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <List disablePadding>
          <ListItemButton onClick={() => navigate('/inventory')}>
            <ListItemIcon><Inventory2OutlinedIcon /></ListItemIcon>
            <ListItemText primary="Show Current Inventory" secondary="Purchased vegetables and their freshness" />
            <ChevronRightIcon />
          </ListItemButton>
        </List>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Weekly meal plan</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            The plan is generated automatically each Sunday evening for the week ahead.
            Use this to fill this week&apos;s empty slots now; meals already planned are never changed.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeOutlinedIcon />}
            onClick={generatePlan}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate this week'}
          </Button>
          {planMessage && <Alert severity="success" sx={{ mt: 2 }}>{planMessage}</Alert>}
        </CardContent>
      </Card>
      <PushNotificationSettings />
      <Card>
        <CardContent>
          <FormControl>
            <FormLabel id="theme-choice-label">Appearance</FormLabel>
            <RadioGroup
              aria-labelledby="theme-choice-label"
              name="theme-choice"
              value={preference}
              onChange={(event) => setColorMode(event.target.value)}
            >
              <FormControlLabel value="light" control={<Radio />} label="Light" />
              <FormControlLabel value="dark" control={<Radio />} label="Dark" />
              <FormControlLabel value="system" control={<Radio />} label="System" />
            </RadioGroup>
          </FormControl>
        </CardContent>
      </Card>
      <Button
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={signOut}
        sx={{ justifySelf: 'start' }}
      >
        Sign out
      </Button>
    </Box>
  );
}
