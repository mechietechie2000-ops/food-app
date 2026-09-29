import { BottomNavigation, BottomNavigationAction, Paper, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { tokens } from '../../theme';

export const BOTTOM_NAV_HEIGHT = 56;

export default function BottomNav({ onAddClick }) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const location = useLocation();
  const navigate = useNavigate();
  const value = location.pathname === '/settings' ? 'settings' : 'add';

  const handleChange = (_event, selected) => {
    if (selected === 'settings') {
      navigate('/settings');
    }
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.appBar,
        pb: 'env(safe-area-inset-bottom)',
        bgcolor: colors.primary[400],
        backgroundImage: 'none',
      }}
    >
      <BottomNavigation
        value={value}
        onChange={handleChange}
        showLabels
        sx={{
          height: BOTTOM_NAV_HEIGHT,
          bgcolor: colors.primary[400],
          '& .MuiBottomNavigationAction-root': { color: colors.grey[500] },
          '& .Mui-selected': { color: colors.greenAccent[600] },
        }}
      >
        <BottomNavigationAction
          value="add"
          label="Add"
          icon={<AddIcon />}
          onClick={onAddClick}
        />
        <BottomNavigationAction
          value="settings"
          label="Menu"
          icon={<MenuOutlinedIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
}
