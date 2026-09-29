import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { ColorModeContext, useMode } from './theme';
import { AuthProvider } from './context/auth-provider';
import { useAuth } from './context/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './components/Login';
import { Register } from './components/Register';
import RecipePlannerPage from './components/RecipePlannerPage';

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login onSwitchToRegister={() => navigate('/register')} onSuccess={() => navigate('/')} />;
}

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Register onSwitchToLogin={() => navigate('/login')} onSuccess={() => navigate('/login')} />;
}

function HomePage() {
  return <RecipePlannerPage />;
}

function AppContent() {
  const [theme, colorMode] = useMode();

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<HomePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
