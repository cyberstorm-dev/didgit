import { useState } from 'react';
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
import { CheckCircle, Warning, AccountBalanceWallet } from '@mui/icons-material';
import { useWallet } from '../wallet/WalletContext';
import { appConfig } from '../utils/config';
import { parseAbi, encodeFunctionData, type Address, type Hex } from 'viem';

const VALIDATOR_ADDRESS = '0x42c340f4bb328df1a62d5cea46be973698ae1e37' as Address;
const VALIDATOR_TYPE = 1; // PLUGIN_TYPE.VALIDATOR from ZeroDev SDK

const kernelAbi = parseAbi([
  'function installModule(uint256 moduleType, address module, bytes initData) payable',
  'function uninstallModule(uint256 moduleType, address module, bytes deInitData) payable'
]);

export function EnableDelegatedAttestations() {
  const { smartAddress, connected, balanceWei, getSmartWalletClient } = useWallet();
  const [activeStep, setActiveStep] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  const cfg = appConfig();
  const hasBalance = balanceWei ? balanceWei > 0n : false;
  const isReady = connected && smartAddress && hasBalance;

  const handleInstallValidator = async () => {
    if (!smartAddress) {
      setError('Smart wallet not initialized');
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      const aaClient = await getSmartWalletClient();
      if (!aaClient) {
        throw new Error('AA client not available');
      }

      // Encode installModule call
      const callData = encodeFunctionData({
        abi: kernelAbi,
        functionName: 'installModule',
        args: [
          BigInt(VALIDATOR_TYPE),
          VALIDATOR_ADDRESS,
          '0x' as Hex // Empty init data
        ]
      });

      console.log('[install] Installing validator:', VALIDATOR_ADDRESS);
      console.log('[install] Call data:', callData);

      // Send UserOp to install module
      const hash = await aaClient.sendTransaction({
        to: smartAddress, // Call to self
        data: callData,
        value: 0n
      });

      setTxHash(hash);
      console.log('[install] TX hash:', hash);

      // Wait for confirmation
      const receipt = await aaClient.waitForUserOperationReceipt({ hash });
      console.log('[install] Receipt:', receipt);

      if (receipt.success) {
        setInstalled(true);
        setActiveStep(3);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (e) {
      console.error('[install] Error:', e);
      setError((e as Error).message || 'Installation failed');
    } finally {
      setInstalling(false);
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
      description: 'Your wallet needs ETH to pay gas (~$0.01)',
      completed: hasBalance,
      action: null
    },
    {
      label: 'Install Validator',
      description: 'Enable automated attestations by installing the validator module',
      completed: installed,
      action: handleInstallValidator
    },
    {
      label: 'Ready',
      description: 'Your wallet is configured for automated commit attestations',
      completed: installed,
      action: null
    }
  ];

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <AccountBalanceWallet color="primary" />
        <Typography variant="h6">
          Enable Automated Attestations
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          This enables the didgit verifier service to automatically attest your commits.
          Your wallet pays gas (from your pre-funded balance), but you don't need to sign each attestation.
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
                  disabled={installing || !isReady}
                  startIcon={installing ? <CircularProgress size={20} /> : undefined}
                >
                  {installing ? 'Installing...' : 'Install Validator'}
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

      {installed && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            ✅ Automated Attestations Enabled!
          </Typography>
          <Typography variant="body2">
            The didgit verifier will now automatically attest your commits.
            Gas will be deducted from your wallet balance.
          </Typography>
        </Alert>
      )}

      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          <strong>Technical Details:</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Validator Address: <code>{VALIDATOR_ADDRESS}</code>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Module Type: Validator (1)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Action: Calls <code>installModule()</code> on your Kernel account
        </Typography>
      </Box>
    </Paper>
  );
}
