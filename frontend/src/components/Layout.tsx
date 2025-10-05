import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Dashboard,
  Dataset,
  PlayArrow,
  Speed,
  Menu as MenuIcon,
  Logout,
  SmartToy,
  Settings,
  ExpandLess,
  ExpandMore,
  Assessment,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { logout } from '../store/authSlice';
import { RootState } from '../store';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: RootState) => state.auth);
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [testRunsOpen, setTestRunsOpen] = useState(
    location.pathname.startsWith('/test-runs') || 
    location.pathname.startsWith('/evaluation-management') ||
    location.pathname.startsWith('/quick-test') ||
    location.pathname.startsWith('/quick-add-parameters')
  );

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const handleTestRunsToggle = () => {
    setTestRunsOpen(!testRunsOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Datasets', icon: <Dataset />, path: '/datasets' },
    { 
      text: 'Test Runs', 
      icon: <PlayArrow />, 
      path: '/test-runs',
      subItems: [
        { text: 'View Test Runs', icon: <Assessment />, path: '/test-runs' },
        { text: 'Quick Test', icon: <Speed />, path: '/quick-test' },
        { text: 'Session Parameters', icon: <Settings />, path: '/session-parameters' },
        { text: 'Evaluation Management', icon: <Settings />, path: '/evaluation-management' },
      ]
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const isParentActive = (parentPath: string) => {
    // For Test Runs parent, check if we're on any of its sub-pages
    if (parentPath === '/test-runs') {
      return location.pathname.startsWith('/test-runs') || 
             location.pathname.startsWith('/evaluation-management') ||
             location.pathname.startsWith('/quick-test') ||
             location.pathname.startsWith('/quick-add-parameters');
    }
    return location.pathname.startsWith(parentPath);
  };

  const drawer = (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        backgroundColor: '#121212', // Match main app background
      }}
    >
      <Toolbar sx={{ 
        justifyContent: 'center', 
        backgroundColor: 'transparent',
        borderBottom: '1px solid #2a2a2a',
        color: 'white',
        py: 2.5,
        px: 1
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <SmartToy sx={{ color: '#0066CC', fontSize: '2rem' }} />
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'white',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            Agent Tester
          </Typography>
        </Box>
      </Toolbar>
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            backgroundColor: '#1a1a1a', // Slightly lighter on hover
            boxShadow: 'inset -4px 0 12px rgba(0, 102, 204, 0.15)', // Blue glow effect
          }
        }}
      >
        <List sx={{ flexGrow: 1 }}>
          {menuItems.map((item) => (
            <React.Fragment key={item.text}>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={() => {
                    if (item.subItems) {
                      if (item.text === 'Test Runs') {
                        setTestRunsOpen(!testRunsOpen);
                      }
                    } else {
                      navigate(item.path);
                    }
                  }}
                  selected={item.subItems ? isParentActive(item.path) : isActive(item.path)}
                  sx={{
                    mx: 1,
                    borderRadius: 1,
                    color: 'white',
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: (item.subItems ? isParentActive(item.path) : isActive(item.path)) ? 'white' : 'rgba(255, 255, 255, 0.7)',
                    },
                  }}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                  {item.subItems && (
                    (item.text === 'Test Runs' && testRunsOpen) ? <ExpandLess /> : <ExpandMore />
                  )}
                </ListItemButton>
              </ListItem>
              
              {item.subItems && item.text === 'Test Runs' && (
                <Collapse in={testRunsOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.subItems.map((subItem) => (
                      <ListItem key={subItem.text} disablePadding>
                        <ListItemButton
                          onClick={() => navigate(subItem.path)}
                          selected={isActive(subItem.path)}
                          sx={{
                            mx: 1,
                            ml: 2,
                            borderRadius: 1,
                            color: 'rgba(255, 255, 255, 0.85)',
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(0, 102, 204, 0.7)',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 102, 204, 0.8)',
                              },
                              '& .MuiListItemIcon-root': {
                                color: 'white',
                              },
                            },
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            },
                            '& .MuiListItemIcon-root': {
                              color: isActive(subItem.path) ? 'white' : 'rgba(255, 255, 255, 0.6)',
                              fontSize: '1.2rem',
                            },
                          }}
                        >
                          <ListItemIcon>
                            {subItem.icon}
                          </ListItemIcon>
                          <ListItemText 
                            primary={subItem.text}
                            primaryTypographyProps={{
                              fontSize: '0.9rem',
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              )}
            </React.Fragment>
          ))}
        </List>
        {/* User info and logout at bottom */}
        <Box sx={{ borderTop: 1, borderColor: '#2a2a2a', p: 1 }}>
          <Typography variant="body2" sx={{ px: 2, py: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
            {user?.full_name}
          </Typography>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={handleLogout}
              sx={{
                mx: 1,
                borderRadius: 1,
                color: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  backgroundColor: 'rgba(220, 38, 38, 0.2)',
                  color: '#ef4444',
                  '& .MuiListItemIcon-root': {
                    color: '#ef4444',
                  },
                },
                '& .MuiListItemIcon-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
              }}
            >
              <ListItemIcon>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Minimal AppBar for mobile menu button only */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          display: { xs: 'block', sm: 'none' }, // Only show on mobile
        }}
      >
        <Toolbar sx={{ minHeight: '48px !important' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              backgroundColor: '#121212',
              borderRight: '1px solid #2a2a2a'
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              backgroundColor: '#121212',
              borderRight: '1px solid #2a2a2a'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          pt: { xs: '60px', sm: 3 }, // Only add top padding on mobile for mini AppBar
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
