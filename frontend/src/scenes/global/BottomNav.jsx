import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper, useTheme } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import { tokens } from '../../theme';

// Index -> route. `null` entries (Search) have no destination yet — they're
// placeholders until those features exist, so onChange no-ops for them.
//
// "Add" used to route to /add-task (the category-based AddTaskForm — see
// scenes/tasks/AddTask.jsx). That form still exists and its route is still
// registered in App.js for later use, but it was never wired into the
// generic sectionFields/SectionForm system this app otherwise uses, so
// bottom-nav "+" now opens the Todo Task quick-add instead (generic
// SectionForm, consistent with every other section's "+").

const ROUTES = ['/', '/todo-task/new', null, '/digiLocker', '/calendar'];

export const BOTTOM_NAV_HEIGHT = 56; // MUI BottomNavigation's default height

const BottomNav = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const navigate = useNavigate();
  const location = useLocation();

  const currentIndex = ROUTES.indexOf(location.pathname);
  const [value, setValue] = useState(currentIndex === -1 ? false : currentIndex);

  // Keep the highlighted tab in sync if the user navigates some other way
  // (sidebar drawer, back button, deep link) rather than tapping this bar.
  useEffect(() => {
    const idx = ROUTES.indexOf(location.pathname);
    setValue(idx === -1 ? false : idx);
  }, [location.pathname]);

  const handleChange = (_event, newValue) => {
    setValue(newValue);
    const target = ROUTES[newValue];
    if (target) navigate(target);
    // else: Search — no destination yet.
  };

  return (
    <Paper
      elevation={8}
      sx={{
        backgroundColor: colors.primary[400],
        backgroundImage: 'none',  
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        // Clears the home-indicator bar on notched/installed-PWA phones.
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        showLabels
        value={value}
        onChange={handleChange}
        //sx={{ backgroundColor: colors.primary[400], height: BOTTOM_NAV_HEIGHT, marginBottom:2, marginLeft:2, marginRight:2 }}
        sx={{
          backgroundColor: colors.primary[400],
          height: BOTTOM_NAV_HEIGHT,
          marginBottom: 2,
          marginLeft: 2,
          marginRight: 2,
          borderRadius: '8px',
          '& .MuiBottomNavigationAction-root': {
            color: colors.grey[100],
          },
          '& .Mui-selected': {
            color: colors.greenAccent[400],
          },
        }}
      >
        <BottomNavigationAction label="Home" icon={<HomeOutlinedIcon />} />
        <BottomNavigationAction label="Todo" icon={<AddCircleOutlinedIcon />} />
        <BottomNavigationAction label="Search" icon={<SearchIcon />} />
        <BottomNavigationAction label="Upload" icon={<CloudUploadOutlinedIcon />} />
        <BottomNavigationAction label="Calendar" icon={<CalendarTodayOutlinedIcon />} />
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;
