// src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  // 1. Prevent flash of unauthenticated state during initial session rehydration
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // 2. Redirect to /login if there is no valid session cookie
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Render child routes/layout if authenticated
  return <Outlet />;
};
