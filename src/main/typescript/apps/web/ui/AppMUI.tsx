import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Navigation, type Page } from './Navigation';
import { RegisterPage } from './RegisterPage';
import { SettingsPage } from './SettingsPage';

export const AppMUI: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('register');

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navigation currentPage={currentPage} onPageChange={handlePageChange} />

      {/* Page Content */}
      <Box sx={{ flex: 1 }}>
        {currentPage === 'register' && <RegisterPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </Box>
    </Box>
  );
};