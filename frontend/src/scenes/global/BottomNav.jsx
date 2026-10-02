import { Badge, BottomNavigation, BottomNavigationAction, Paper, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AddShoppingCartOutlinedIcon from '@mui/icons-material/AddShoppingCartOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { tokens } from '../../theme';

export const BOTTOM_NAV_HEIGHT = 56;

// Pages that live under the hamburger Menu keep "Menu" highlighted.
const MENU_PATHS = ['/settings', '/inventory', '/breakfast'];

/**
 * Bottom bar: Home | Add | Groceries | Confirm | Menu.
 * Home and Menu are pages (they highlight). Add, Groceries and Confirm open
 * dialogs, so they never stay highlighted.
 *
 * - pendingPurchaseCount: grocery items waiting for purchase confirmation.
 *   The Confirm icon shows this as a badge; when it reaches 0 the badge
 *   disappears, which is how the bar tells you something needs attention.
 * - unconfirmedMealCount: past meals nobody has answered yet (badge on Home).
 */
export default function BottomNav({
  onAddClick,
  onGroceriesClick,
  onConfirmClick,
  pendingPurchaseCount = 0,
  unconfirmedMealCount = 0,
}) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const location = useLocation();
  const navigate = useNavigate();

  let value = false;
  if (location.pathname === '/') value = 'home';
  else if (MENU_PATHS.includes(location.pathname)) value = 'menu';

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
        showLabels
        sx={{
          height: BOTTOM_NAV_HEIGHT,
          bgcolor: colors.primary[400],
          // Five actions must fit a 360px phone; MUI's default 80px minimum would not.
          '& .MuiBottomNavigationAction-root': { color: colors.grey[500], minWidth: 0, px: 0.5 },
          '& .Mui-selected': { color: colors.greenAccent[600] },
        }}
      >
        <BottomNavigationAction
          value="home"
          label="Home"
          aria-label={unconfirmedMealCount > 0 ? `Home, ${unconfirmedMealCount} meals to confirm` : 'Home'}
          icon={(
            <Badge color="warning" badgeContent={unconfirmedMealCount} max={9}>
              <HomeOutlinedIcon />
            </Badge>
          )}
          onClick={() => navigate('/')}
        />
        <BottomNavigationAction
          value="add"
          label="Add"
          icon={<AddIcon />}
          onClick={onAddClick}
        />
        <BottomNavigationAction
          value="groceries"
          label="Groceries"
          icon={<AddShoppingCartOutlinedIcon />}
          onClick={onGroceriesClick}
        />
        <BottomNavigationAction
          value="confirm"
          label="Confirm"
          aria-label={pendingPurchaseCount > 0 ? `Confirm purchases, ${pendingPurchaseCount} waiting` : 'Confirm purchases'}
          icon={(
            <Badge color="error" badgeContent={pendingPurchaseCount} max={9}>
              <FactCheckOutlinedIcon />
            </Badge>
          )}
          onClick={onConfirmClick}
        />
        <BottomNavigationAction
          value="menu"
          label="Menu"
          icon={<MenuOutlinedIcon />}
          onClick={() => navigate('/settings')}
        />
      </BottomNavigation>
    </Paper>
  );
}
