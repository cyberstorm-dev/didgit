import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  ContentCopy,
  AccountBalanceWallet,
  CheckCircle,
  Warning,
  Refresh,
} from '@mui/icons-material';
import { useWallet } from '../wallet/WalletContext';
import { formatEther } from 'viem';
import { appConfig } from '../utils/config';

export const AAWalletStatus: React.FC = () => {
  // Force fresh hook call every render
  const {
    smartAddress,
    connected,
    isContract,
    balanceWei,
    refreshOnchain,
    ensureAa,
    lastError,
    address
  } = useWallet();


  const [fundingFaucet, setFundingFaucet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forceRender, setForceRender] = useState(0);

  const cfg = appConfig();
  const balance = balanceWei ? parseFloat(formatEther(balanceWei)) : 0;
  const hasBalance = balance > 0;
  const isReady = connected && smartAddress && hasBalance;
  const isMainnet = cfg.CHAIN_ID === 8453;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await ensureAa();
      await refreshOnchain();
    } catch (e) {
      // Error handled by wallet hook
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-refresh status when wallet connects or disconnects
  useEffect(() => {
      setForceRender(prev => prev + 1); // Force re-render
    if (connected) {
      // Always refresh on connect, even if smart address not ready yet
      handleRefresh();
    } else {
      // Reset state on disconnect - force component to re-render
      setFundingFaucet(false);
      setRefreshing(false);
    }
  }, [connected]);

  // Additional refresh when smart address becomes available
  useEffect(() => {
    if (connected && smartAddress) {
      handleRefresh();
    }
  }, [connected, smartAddress]);

  const copyAddress = async () => {
    if (smartAddress) {
      try {
        await navigator.clipboard.writeText(smartAddress);
      } catch (e) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = smartAddress;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }
  };

  const handleFaucet = async () => {
    setFundingFaucet(true);
    try {
      if (cfg.CHAIN_ID === 84532) {
        // Base Sepolia faucet
        window.open(`https://www.coinbase.com/faucets/base-sepolia-faucet?address=${smartAddress}`, '_blank');
      } else {
        // For mainnet, open a bridge/DEX instead
        window.open('https://bridge.base.org/', '_blank');
      }

      // Wait a moment then refresh balance
      setTimeout(async () => {
        await refreshOnchain();
        setFundingFaucet(false);
      }, 2000);
    } catch (e) {
      setFundingFaucet(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <Alert severity="info">
        Connect your wallet using the button in the top-right corner to get started.
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <AccountBalanceWallet color="primary" />
        <Typography variant="h6">
          Smart Wallet Status
        </Typography>
        <Tooltip title="Refresh status">
          <IconButton onClick={handleRefresh} size="small" disabled={refreshing}>
            {refreshing ? <CircularProgress size={20} /> : <Refresh />}
          </IconButton>
        </Tooltip>
      </Box>

      {smartAddress && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            {/* Wallet Address */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {formatAddress(smartAddress)}
                </Typography>
              </Box>
              <Tooltip title="Copy address">
                <IconButton onClick={copyAddress} size="small">
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Balance */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Balance
                </Typography>
                <Typography variant="body1">
                  {balance.toFixed(8)} ETH
                </Typography>
              </Box>
              <Chip
                icon={hasBalance ? <CheckCircle /> : <Warning />}
                label={hasBalance ? 'Funded' : 'Needs Gas'}
                color={hasBalance ? 'success' : 'warning'}
                size="small"
              />
            </Box>

            {/* Status */}
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body1">
                  {isReady ? 'Ready for attestations' : 'Setup required'}
                </Typography>
              </Box>
              <Chip
                icon={isReady ? <CheckCircle /> : <Warning />}
                label={isReady ? 'Ready' : 'Not Ready'}
                color={isReady ? 'success' : 'warning'}
                size="small"
              />
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Funding Options */}
      {!hasBalance && smartAddress && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Wallet Needs Funding
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Your smart wallet needs ETH to pay for transaction gas on {isMainnet ? 'Base' : 'Base Sepolia'}.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              onClick={handleFaucet}
              disabled={fundingFaucet}
              startIcon={fundingFaucet ? <CircularProgress size={16} /> : undefined}
            >
              {fundingFaucet ? (isMainnet ? 'Opening Bridge...' : 'Opening Faucet...') : (isMainnet ? 'Bridge ETH' : 'Get Test ETH')}
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Error Display */}
      {lastError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {lastError}
          </Typography>
        </Alert>
      )}

      {/* Helpful Info */}
      {isReady && (
        <Alert severity="success">
          <Typography variant="body2">
            ✅ Your smart wallet is ready! You can now create attestations without switching networks.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};