import { Box, IconButton, Menu, MenuItem, Divider, ListItemIcon, Typography, useTheme } from "@mui/material";
import { useContext, useState } from "react";
import { ColorModeContext, tokens } from "../../theme";
import InputBase from "@mui/material/InputBase";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
// import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SearchIcon from "@mui/icons-material/Search";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/Logout";
import { useAuth } from "../../context/useAuth";
import { subscribeToPush, unsubscribeFromPush } from "../../services/pushService";

const hasNotificationApi = typeof window !== "undefined" && "Notification" in window;

const Topbar = ({ onMenuClick = () => {} }) => {
  const { logout, user } = useAuth(); // Assume user info exists in AuthContext
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : "User";  
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);

  const [pushEnabled, setPushEnabled] = useState(
    hasNotificationApi && Notification.permission === "granted"
  );
  const [pushLoading, setPushLoading] = useState(false);

  // Profile Menu State
  const [anchorEl, setAnchorEl] = useState(null);
  const isProfileMenuOpen = Boolean(anchorEl);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const handlePushToggle = async () => {
    if (!hasNotificationApi || pushLoading) return;
    setPushLoading(true);
    try {
      if (!pushEnabled) {
        await subscribeToPush();
        setPushEnabled(true);
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
      alert(err.message);
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <Box 
      // display="flex" justifyContent="space-between" alignItems="center" p={2}>
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      p={2}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: "background.default",
      }}
    >
    {/* Mobile Drawer Trigger */}
      <IconButton
        onClick={onMenuClick}
        sx={{ display: { xs: "flex", md: "none" }, mr: 1 }}
      >
        <MenuOutlinedIcon />
      </IconButton>

      {/* Search Input */}
      <Box
        display="flex"
        backgroundColor={colors.primary[400]}
        borderRadius="3px"
        flex={1}
        maxWidth={{ xs: "100%", md: 400 }}
      >
        <InputBase sx={{ ml: 2, flex: 1 }} placeholder="Search" />
        <IconButton type="button" sx={{ p: 1 }}>
          <SearchIcon />
        </IconButton>
      </Box>

      {/* Action Controls & Profile Menu */}
      <Box display="flex" alignItems="center" gap={1}>
        <IconButton onClick={colorMode.toggleColorMode}>
          {theme.palette.mode === "dark" ? (
            <DarkModeOutlinedIcon />
          ) : (
            <LightModeOutlinedIcon />
          )}
        </IconButton>

        {hasNotificationApi && (
          <IconButton
            onClick={handlePushToggle}
            disabled={pushLoading}
            title={pushEnabled ? "Disable notifications" : "Enable notifications"}
            color={pushEnabled ? "success" : "default"}
          >
            {pushEnabled ? (
              <NotificationsActiveOutlinedIcon />
            ) : (
              <NotificationsOutlinedIcon />
            )}
          </IconButton>
        )}

        {/* Profile Avatar Toggle Button */}
        <IconButton
          onClick={handleProfileMenuOpen}
          aria-controls={isProfileMenuOpen ? "profile-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={isProfileMenuOpen ? "true" : undefined}
        >
          <PersonOutlinedIcon />
        </IconButton>

        {/* Dropdown Menu */}
        <Menu
          anchorEl={anchorEl}
          id="profile-menu"
          open={isProfileMenuOpen}
          onClose={handleProfileMenuClose}
          onClick={handleProfileMenuClose}
          PaperProps={{
            elevation: 3,
            sx: {
              backgroundColor: colors.primary[400],
              color: colors.grey[100],
              mt: 1.5,
              minWidth: 180,
            },
          }}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        >
          <Box px={2} py={1}>
            <Typography variant="h6" fontWeight="bold">
              {displayName}
            </Typography>
            <Typography variant="body2" color={colors.greenAccent[500]}>
              {user?.role || "Admin"}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon sx={{ color: colors.grey[100] }}>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default Topbar;