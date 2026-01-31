import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Typography,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountBalanceWallet,
  ContentCopy,
  ExitToApp
} from '@mui/icons-material';
import { useWallet } from '../wallet/WalletContext';

export const WalletButton: React.FC = () => {
  const walletData = useWallet();
  const { connected, address, smartAddress, connect, disconnect, provisioning } = walletData;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (connected) {
      setAnchorEl(event.currentTarget);
    } else {
      connect();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };


  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (e) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    handleClose();
  };

  const formatAddress = (address: string) => {
    if (!address || address.length < 10) return 'Connect Wallet';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <Button
        variant="contained"
        startIcon={<AccountBalanceWallet />}
        onClick={handleClick}
        disabled={provisioning}
        sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        {provisioning ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleClick}
        sx={{
          borderRadius: 2,
          textTransform: 'none',
          color: 'white',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          '&:hover': {
            borderColor: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <AccountBalanceWallet fontSize="small" />
          <Typography variant="body2" fontWeight={500} sx={{ color: 'white' }}>
            {formatAddress(address || '')}
          </Typography>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { mt: 1, minWidth: 200 }
        }}
      >
        {address && (
          <MenuItem onClick={() => copyAddress(address)}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <ContentCopy fontSize="small" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  EOA Wallet
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {formatAddress(address)}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        )}

        {smartAddress && (
          <MenuItem onClick={() => copyAddress(smartAddress)}>
            <Box display="flex" alignItems="center" gap={1} width="100%">
              <ContentCopy fontSize="small" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Smart Wallet
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {formatAddress(smartAddress)}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        )}

        <MenuItem onClick={() => { disconnect(); handleClose(); }}>
          <Box display="flex" alignItems="center" gap={1}>
            <ExitToApp fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Disconnect
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
};