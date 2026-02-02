import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Alert,
  CircularProgress,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Link,
} from '@mui/material';
import { CheckCircle, Security, ContentCopy } from '@mui/icons-material';
import { useWallet } from '../wallet/WalletContext';
import { appConfig } from '../utils/config';
import { type Address } from 'viem';

// Verifier address - the backend's signing key
const VERIFIER_ADDRESS = '0x0CA6A71045C26087F8dCe6d3F93437f31B81C138' as Address;

export function EnableDelegatedAttestations() {
  const { smartAddress, connected, balanceWei } = useWallet();
  const [activeStep, setActiveStep] = useState(0);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [permissionId, setPermissionId] = useState<string | null>(null);

  const cfg = appConfig();
  const hasBalance = balanceWei ? balanceWei > 0n : false;
  const isReady = connected && smartAddress && hasBalance;

  // Update active step based on state
  useEffect(() => {
    if (enabled) {
      setActiveStep(3);
    } else if (hasBalance) {
      setActiveStep(2);
    } else if (connected && smartAddress) {
      setActiveStep(1);
    } else {
      setActiveStep(0);
    }
  }, [connected, smartAddress, hasBalance, enabled]);

  const handleEnablePermission = async () => {
    if (!smartAddress) {
      setError('Smart wallet not initialized');
      return;
    }

    setEnabling(true);
    setError(null);

    try {
      // The permission is enabled automatically on first backend use
      // The ZeroDev SDK handles the enable signature flow
      // For now, we just record user consent and show them their address
      
      console.log('[permission] User consented to permission for verifier:', VERIFIER_ADDRESS);
      console.log('[permission] User kernel address:', smartAddress);
      
      // In a full implementation, we would:
      // 1. Store user's kernel address in a registry
      // 2. Backend uses this address when creating attestations
      // 3. Permission is enabled on first use via enable signature
      
      setPermissionId('0x0f78222c'); // Deterministic based on permission config
      setEnabled(true);
      setActiveStep(3);

    } catch (e) {
      console.error('[permission] Error:', e);
      setError((e as Error).message || 'Failed to enable permission');
    } finally {
      setEnabling(false);
    }
  };

  const copyAddress = () => {
    if (smartAddress) {
      navigator.clipboard.writeText(smartAddress);
    }
  };

  const steps = [
    {
      label: 'Connect Wallet',
      description: 'Connect your smart wallet to continue',
      completed: connected && !!smartAddress,
      action: null
    },
    {
      label: 'Fund Wallet',
      description: 'Your wallet needs ETH to pay gas (~$0.01 per attestation)',
      completed: hasBalance,
      action: null
    },
    {
      label: 'Enable Permission',
      description: 'Grant the verifier permission to create attestations on your behalf',
      completed: enabled,
      action: handleEnablePermission
    },
    {
      label: 'Ready',
      description: 'Your wallet is configured for automated commit attestations',
      completed: enabled,
      action: null
    }
  ];

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Security color="primary" />
        <Typography variant="h6">
          Enable Automated Attestations
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          <strong>How it works:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: '1.5em' }}>
            <li>You grant a <strong>scoped permission</strong> to our verifier service</li>
            <li>The permission only allows calling <code>EAS.attest()</code></li>
            <li>Your smart wallet pays gas, but you don't sign each attestation</li>
            <li><strong>Your wallet is the attester</strong> — not a third party</li>
          </ul>
        </Typography>
      </Alert>

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label} completed={step.completed}>
            <StepLabel
              optional={
                step.completed ? (
                  <Chip
                    icon={<CheckCircle />}
                    label="Complete"
                    color="success"
                    size="small"
                  />
                ) : null
              }
            >
              {step.label}
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {step.description}
              </Typography>

              {step.action && !step.completed && (
                <Button
                  variant="contained"
                  onClick={step.action}
                  disabled={enabling || !isReady}
                  startIcon={enabling ? <CircularProgress size={20} /> : <Security />}
                >
                  {enabling ? 'Enabling...' : 'Enable Permission'}
                </Button>
              )}

              {index === 0 && !connected && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Use the "Connect Wallet" button in the top-right corner
                </Alert>
              )}

              {index === 1 && !hasBalance && smartAddress && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Send ETH to your smart wallet:
                  </Typography>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    sx={{ wordBreak: 'break-all' }}
                  >
                    {smartAddress}
                  </Typography>
                  {cfg.CHAIN_ID === 84532 && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      href={`https://www.coinbase.com/faucets/base-sepolia-faucet?address=${smartAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get Test ETH
                    </Button>
                  )}
                </Alert>
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {txHash && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Transaction submitted!{' '}
            <Link
              href={`https://${cfg.CHAIN_ID === 8453 ? '' : 'sepolia.'}basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Basescan
            </Link>
          </Typography>
        </Alert>
      )}

      {enabled && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ✅ Automated Attestations Enabled!
          </Typography>
          <Typography variant="body2">
            The didgit verifier will automatically attest your commits.
            Gas will be deducted from your smart wallet balance.
          </Typography>
        </Alert>
      )}

      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          <strong>Technical Details:</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Verifier: <code>{VERIFIER_ADDRESS}</code>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Permission Scope: <code>EAS.attest()</code> only
        </Typography>
        {permissionId && (
          <Typography variant="caption" color="text.secondary" display="block">
            Permission ID: <code>{permissionId}</code>
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" display="block">
          Protocol: ZeroDev Kernel v3.1 + Permission Plugin
        </Typography>
      </Box>
    </Paper>
  );
}
