import { useState } from "react";
import { ProSidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import { Box, IconButton, Typography, useTheme, useMediaQuery } from "@mui/material";
import { Link } from "react-router-dom";
// import "react-pro-sidebar/dist/css/styles.css";
import { tokens } from "../../theme";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
// import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import PieChartOutlineOutlinedIcon from "@mui/icons-material/PieChartOutlineOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
// import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import LunchDiningRoundedIcon from '@mui/icons-material/LunchDiningRounded';
import SportsHandballRoundedIcon from '@mui/icons-material/SportsHandballRounded';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import QueryBuilderIcon from '@mui/icons-material/QueryBuilder';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import LockIcon from '@mui/icons-material/Lock';

const Item = ({ title, to, icon, selected, setSelected, onSelect }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <MenuItem
      active={selected === title}
      style={{ color: colors.grey[100] }}
      onClick={() => {
        setSelected(title);
        if (onSelect) onSelect();
      }}
      icon={icon}
    >
      <Typography>{title}</Typography>
      <Link to={to} />
    </MenuItem>
  );
};

const Sidebar = ({ isMobileOpen = false, onMobileClose = () => {} }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selected, setSelected] = useState("Dashboard");
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // const isMobile = useMediaQuery("(max-width:768px)");

  return (
    <Box
        sx={{
            height: "100%",
            "& .pro-sidebar-inner": {
              background: `${colors.primary[400]} !important`,
            },
            "& .pro-icon-wrapper": {
              backgroundColor: "transparent !important",
            },
            "& .pro-inner-item": {
              padding: "5px 35px 5px 20px !important",
            },
            "& .pro-inner-item:hover": {
              color: "#868dfb !important",
            },
            "& .pro-menu-item.active": {
              color: "#6870fa !important",
            },
          }}
    >
      <ProSidebar
        collapsed={isMobile ? false : isCollapsed}
        breakPoint="md"
        toggled={isMobileOpen}
        onToggle={(toggled) => {
          if (!toggled) onMobileClose();
        }}
      >
        <Menu iconShape="square">
          {/* LOGO AND COLLAPSE TOGGLE ICON */}
          <MenuItem
            onClick={() => !isMobile && setIsCollapsed(!isCollapsed)}
            icon={(!isMobile && isCollapsed) ? <MenuOutlinedIcon /> : undefined}
            style={{
              margin: "10px 0 20px 0",
              color: colors.grey[100],
            }}
          >
            {(isMobile || !isCollapsed) && (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                ml="15px"
              >
                <Typography variant="h3" color={colors.grey[100]}>
                  Home Sweet Home
                </Typography>
                {!isMobile && (
                  <IconButton onClick={() => setIsCollapsed(!isCollapsed)}>
                    <MenuOutlinedIcon />
                  </IconButton>
                )}
              </Box>
            )}
          </MenuItem>

          {(isMobile || !isCollapsed) && (
            <Box mb="25px">
              <Box display="flex" justifyContent="center" alignItems="center">
                <img
                  alt="profile-user"
                  width="100px"
                  height="100px"
                  src={`../../assets/user.png`}
                  style={{ cursor: "pointer", borderRadius: "50%" }}
                />
              </Box>
              <Box textAlign="center">
                <Typography
                  variant="h2"
                  color={colors.grey[100]}
                  fontWeight="bold"
                  sx={{ m: "10px 0 0 0" }}
                >
                  Sandarbh
                </Typography>
                <Typography variant="h5" color={colors.greenAccent[500]}>
                  Boss
                </Typography>
              </Box>
            </Box>
          )}

          <Box paddingLeft={(isMobile || !isCollapsed) ? "10%" : undefined}>
            <Item
              title="Dashboard"
              to="/"
              icon={<HomeOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
              onSelect={isMobile ? onMobileClose : undefined}
            />
            
            <SubMenu title="Daily Routine" icon={<QueryBuilderIcon />} opened={true}>
              <Item title="Events" to="/kids" icon={<QueryBuilderIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Routines" to="/routine" icon={<PeopleOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Routine Admin" to="/routine/admin" icon={<PeopleOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />              
              <Item title="Calendar" to="/calendar" icon={<CalendarTodayOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <Item
              title="Digi Locker"
              to="/digiLocker"
              icon={<LockIcon />}
              selected={selected}
              setSelected={setSelected}
              onSelect={isMobile ? onMobileClose : undefined}
            />

            <SubMenu title="Kids" icon={<ChildCareIcon />} opened={true}>
              <Item title="Meal Plan" to="/kids" icon={<LunchDiningRoundedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Extra Curriculum" to="/sports" icon={<SportsHandballRoundedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="School Calendar" to="/schoolcalender" icon={<CalendarTodayOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <SubMenu title="Insurance" icon={<PersonOutlinedIcon />} opened={false}>
              <Item title="Auto" to="/auto" icon={<PeopleOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Health" to="/health" icon={<ContactsOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Home" to="/home" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Life" to="/life" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <SubMenu title="Personal" icon={<PersonOutlinedIcon />} opened={false}>
              <Item title="Passport" to="/passport" icon={<PeopleOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Driver License" to="/health" icon={<ContactsOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Account Logins" to="/logins" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="H1" to="/h1" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <SubMenu title="Education" icon={<PersonOutlinedIcon />} opened={false}>
              <Item title="Marksheets" to="/marksheet" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Something" to="/something" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <SubMenu title="Medical" icon={<PersonOutlinedIcon />} opened={false}>
              <Item title="Insurance Information" to="/bar" icon={<BarChartOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Service Provider" to="/pie" icon={<PieChartOutlineOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Appointments" to="/medical" icon={<LocalHospitalIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <SubMenu title="Reports" icon={<BarChartOutlinedIcon />} opened={false}>
              <Item title="Overview" to="/reports/overview" icon={<TimelineOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            {/*
            <SubMenu title="Ed-roh Data" icon={<PersonOutlinedIcon />} opened={false}>
              <Item title="Manage Team" to="/team" icon={<PeopleOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Contacts Information" to="/contacts" icon={<ContactsOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Invoices Balances" to="/invoices" icon={<ReceiptOutlinedIcon color="success"/>} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>

            <SubMenu title="Ed-roh" icon={<PersonOutlinedIcon />} opened={false}>
              <Item title="Profile Form" to="/form" icon={<PersonOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Calendar" to="/calendar" icon={<CalendarTodayOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="FAQ Page" to="/faq" icon={<HelpOutlineOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Bar Chart" to="/bar" icon={<BarChartOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Pie Chart" to="/pie" icon={<PieChartOutlineOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Line Chart" to="/line" icon={<TimelineOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
              <Item title="Geography Chart" to="/geography" icon={<MapOutlinedIcon />} selected={selected} setSelected={setSelected} onSelect={isMobile ? onMobileClose : undefined} />
            </SubMenu>
            */}

          </Box>
        </Menu>
      </ProSidebar>
    </Box>
  );
};

export default Sidebar;