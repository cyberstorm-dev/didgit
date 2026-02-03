import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import { BarChart } from '@mui/icons-material';
import { WalletButton } from './WalletButton';

export type Page = 'register' | 'stats' | 'settings';

interface NavigationProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange }) => {
  const handleTabChange = (_: React.SyntheticEvent, newValue: Page) => {
    onPageChange(newValue);
  };

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        {/* Logo and App Name */}
        <Typography variant="h6" component="h1" sx={{ mr: 4 }}>
          didgit.dev
        </Typography>

        {/* Page Navigation Tabs */}
        <Box sx={{ flexGrow: 1 }}>
          <Tabs
            value={currentPage}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                textTransform: 'none',
                fontWeight: 500,
                minWidth: 80,
                '&.Mui-selected': {
                  color: 'white !important',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'white',
              },
            }}
          >
            <Tab label="Register" value="register" />
            <Tab 
              label="Stats" 
              value="stats" 
              icon={<BarChart sx={{ fontSize: 18 }} />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab label="Settings" value="settings" />
          </Tabs>
        </Box>

        {/* Wallet Connection Button */}
        <WalletButton />
      </Toolbar>
    </AppBar>
  );
};
