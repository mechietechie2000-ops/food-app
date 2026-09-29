import { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';

export default function PlannerTopbar() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY < 24);
    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        color: 'text.primary',
        bgcolor: 'transparent',
        backgroundImage: 'none',
        pointerEvents: 'none',
        transition: 'opacity 180ms ease, transform 180ms ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-16px)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'center', minHeight: { xs: 52, sm: 60 } }}>
        <Typography
          component="div"
          sx={{
            fontFamily: '"Lobster", "Brush Script MT", cursive',
            fontSize: { xs: '1.9rem', sm: '2.2rem' },
            fontStyle: 'italic',
            lineHeight: 1,
            textShadow: '0 1px 12px rgba(0, 0, 0, 0.12)',
          }}
        >
          Food Planner
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
