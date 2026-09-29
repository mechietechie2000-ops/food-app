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
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { ColorModeContext } from '../theme';
import { useAuth } from '../context/useAuth';
import PushNotificationSettings from './PushNotificationSettings';

export default function PlannerSettingsPage() {
  const { preference, setColorMode } = useContext(ColorModeContext);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const signOut = async () => {
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (signOutError) {
      setError(signOutError.message || 'Could not sign out.');
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', display: 'grid', gap: 2 }}>
      <Typography variant="h4">Menu</Typography>
      {error && <Alert severity="error">{error}</Alert>}
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
