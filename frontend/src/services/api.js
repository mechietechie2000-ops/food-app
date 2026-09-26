// src/services/api.js

//const API_BASE_URL = 'http://localhost:5001/api';
// const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? (process.env.REACT_APP_API_URL || 'http://localhost:5001/api')
    : '/api';

console.log("API BASE URL", API_BASE_URL)

// Callback hook to notify AuthContext when a 401 occurs
let onUnauthorizedCallback = null;

export const setUnauthorizedHandler = (handler) => {
  onUnauthorizedCallback = handler;
};

export const api = async (endpoint, options = {}) => {
  const config = {
    ...options,
    // CRITICAL: Tells the browser to send/receive httpOnly cookies with requests
    credentials: 'include', 
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Handle session expiration or missing auth cookies globally
    if (response.status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
      const errorData = await response.json().catch(() => ({}));
      // Backend error handlers send { error: "..." } (see routes/sections.js
      // and others); some older routes may send { message: "..." } instead.
      throw new Error(errorData.error || errorData.message || 'Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Return JSON if present, otherwise null
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (err) {
    throw err;
  }
};

// Convenience wrappers so callers can do `const { data } = await api.get(...)`
// without changing every existing `api(endpoint, options)` call site.
api.get = async (endpoint, options = {}) => {
  const data = await api(endpoint, { ...options, method: 'GET' });
  return { data };
};

api.post = async (endpoint, body, options = {}) => {
  const data = await api(endpoint, { ...options, method: 'POST', body });
  return { data };
};

api.put = async (endpoint, body, options = {}) => {
  const data = await api(endpoint, { ...options, method: 'PUT', body });
  return { data };
};

api.delete = async (endpoint, options = {}) => {
  const data = await api(endpoint, { ...options, method: 'DELETE' });
  return { data }
};

api.patch = async (endpoint, body, options = {}) => {
  const data = await api(endpoint, { ...options, method: 'PATCH', body });
  return { data };
};