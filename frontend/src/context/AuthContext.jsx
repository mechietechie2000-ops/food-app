// src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Synchronize 401 handling from API helper with local state
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
  }, []);

  // Check if user is already logged in (rehydrate session via httpOnly cookie)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Assumes your backend has an endpoint (e.g. GET /api/auth/me) 
        // that validates the cookie and returns the logged-in user profile
        const data = await api('/auth/me', { method: 'GET' });
        setUser(data.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    // Cookie is set directly by backend in Set-Cookie header
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
