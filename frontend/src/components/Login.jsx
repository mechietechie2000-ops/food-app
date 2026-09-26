// src/components/Login.jsx

import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Alert,
  useTheme
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme'; // Import your custom color tokens

export const Login = ({ onSwitchToRegister, onSuccess }) => {
  const { login } = useAuth();
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Full screen wrapper using your application's primary background color
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      width="100vw"
      backgroundColor={colors.primary[500]}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: colors.primary[400], // Matches Sidebar/Topbar card backgrounds
          borderRadius: '8px',
          boxShadow: '0px 10px 25px rgba(0,0,0,0.3)',
        }}
      >
        <Typography
          component="h1"
          variant="h3"
          fontWeight="bold"
          color={colors.grey[100]}
          sx={{ mb: 3 }}
        >
          Sign In
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{
              '& .MuiInputLabel-root': { color: colors.grey[200] },
              '& .MuiOutlinedInput-root': {
                color: colors.grey[100],
                '& fieldset': { borderColor: colors.grey[400] },
                '&:hover fieldset': { borderColor: colors.greenAccent[500] },
                '&.Mui-focused fieldset': { borderColor: colors.greenAccent[500] },
              },
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              '& .MuiInputLabel-root': { color: colors.grey[200] },
              '& .MuiOutlinedInput-root': {
                color: colors.grey[100],
                '& fieldset': { borderColor: colors.grey[400] },
                '&:hover fieldset': { borderColor: colors.greenAccent[500] },
                '&.Mui-focused fieldset': { borderColor: colors.greenAccent[500] },
              },
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isSubmitting}
            sx={{
              mt: 3,
              mb: 2,
              p: '10px 0',
              backgroundColor: colors.greenAccent[600],
              color: colors.grey[100],
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: colors.greenAccent[500],
              },
            }}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>

          {onSwitchToRegister && (
            <Button
              fullWidth
              variant="text"
              onClick={onSwitchToRegister}
              sx={{
                color: colors.greenAccent[500],
                textTransform: 'none',
                fontWeight: 'bold',
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: colors.greenAccent[400],
                },
              }}
            >
              Don't have an account? Sign Up
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};