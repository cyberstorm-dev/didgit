import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Divider,
  Chip,
  Stack,
  Paper,
  Grid,
  Container,
  Tabs,
  Tab,
  Skeleton,
  Badge,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { Settings, Add, Info, Visibility, List, Refresh, HelpOutline, Code } from '@mui/icons-material';
import { z } from 'zod';
import { useWallet } from '../wallet/WalletContext';
import { useGithubAuth } from '../auth/useGithub';
import { appConfig } from '../utils/config';
// For now, let's inline the types and ABI until the package system is properly set up
interface RepositoryPattern {
  namespace: string;
  name: string;
  enabled: boolean;
}

// Validation functions
function validateDomain(domain: string): boolean {
  return domain.length > 0 && domain.length <= 100;
}

function validateUsername(username: string): boolean {
  return username.length > 0 && username.length <= 39;
}

function validateNamespace(namespace: string): boolean {
  return namespace.length > 0 && namespace.length <= 39;
}

function validateRepoName(name: string): boolean {
  return name.length > 0 && name.length <= 100;
}

// StandaloneAttestor ABI (actual deployed contract)
const StandaloneAttestorABI = [
  {
    "type": "function",
    "name": "setRepositoryPattern",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "identifier", "type": "string" },
      { "name": "namespace", "type": "string" },
      { "name": "name", "type": "string" },
      { "name": "enabled", "type": "bool" }
    ],
    "outputs": [
      { "name": "success", "type": "bool" },
      { "name": "error", "type": "string" },
      { "name": "transaction_hash", "type": "string" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getRepositoryPatterns",
    "inputs": [
      { "name": "domain", "type": "string" },
      { "name": "identifier", "type": "string" }
    ],
    "outputs": [
      { "name": "patterns", "type": "string[]" }
    ],
    "stateMutability": "view"
  }
] as const;
import { createPublicClient, http, type Hex } from 'viem';
import { baseSepolia } from '../utils/eas';

const repoPatternSchema = z.object({
  domain: z.string().min(1).max(100),
  username: z.string().min(1).max(39),
  namespace: z.string().min(1).max(39),
  name: z.string().min(1).max(100),
  enabled: z.boolean(),
});

interface RepoPatternForm {
  namespace: string;
  name: string;
  enabled: boolean;
}

interface RepoManagerMUIProps {
  domain?: string;
  username?: string;
}

export const RepoManagerMUI: React.FC<RepoManagerMUIProps> = ({
  domain = 'github.com',
  username
}) => {
  const { address, smartAddress, connected, getWalletClient } = useWallet();
  const { user } = useGithubAuth();
  const cfg = useMemo(() => appConfig(), []);

  // Form state
  const [form, setForm] = useState<RepoPatternForm>({
    namespace: '*',
    name: '*',
    enabled: true,
  });

  // View state
  const [viewMode, setViewMode] = useState<'set' | 'list'>('set');
  const [existingPatterns, setExistingPatterns] = useState<RepositoryPattern[]>([]);
  const [errors, setErrors] = useState<Partial<RepoPatternForm>>({});

  // Component state
  const [busySet, setBusySet] = useState(false);
  const [busyLoad, setBusyLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoLoadTriggered, setAutoLoadTriggered] = useState(false);

  const resolverAddress = cfg.RESOLVER_ADDRESS as `0x${string}` | undefined;
  const resolverReady = !!resolverAddress;

  // Use provided username or fall back to GitHub auth
  const effectiveUsername = username || user?.login || '';
  const effectiveDomain = domain;

  // Auto-load patterns when switching to list view
  useEffect(() => {
    if (viewMode === 'list' && !autoLoadTriggered && connected && resolverAddress && effectiveDomain && effectiveUsername) {
      setAutoLoadTriggered(true);
      loadExistingPatterns();
    }
    if (viewMode === 'set') {
      setAutoLoadTriggered(false);
    }
  }, [viewMode, connected, resolverAddress, effectiveDomain, effectiveUsername]);

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http()
    });
  }, []);

  const validateForm = () => {
    const newErrors: Partial<RepoPatternForm> = {};

    // Domain and username validation now based on props
    if (!effectiveDomain) {
      setError('Domain is required');
      return false;
    } else if (!validateDomain(effectiveDomain)) {
      setError('Invalid domain format');
      return false;
    }

    if (!effectiveUsername) {
      setError('Username is required');
      return false;
    } else if (!validateUsername(effectiveUsername)) {
      setError('Invalid username format');
      return false;
    }

    if (!form.namespace) {
      newErrors.namespace = 'Namespace is required';
    } else if (!validateNamespace(form.namespace)) {
      newErrors.namespace = 'Invalid namespace format';
    }

    if (!form.name) {
      newErrors.name = 'Repository name is required';
    } else if (!validateRepoName(form.name)) {
      newErrors.name = 'Invalid repository name format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loadExistingPatterns = async () => {
    if (!connected || !address || !resolverAddress || !effectiveDomain || !effectiveUsername) return;

    try {
      setBusyLoad(true);
      setError(null);

      const patterns = await publicClient.readContract({
        address: resolverAddress,
        abi: UsernameUniqueResolverABI,
        functionName: 'getRepositoryPatterns',
        args: [effectiveDomain, effectiveUsername],
      });

      setExistingPatterns(patterns as RepositoryPattern[]);
    } catch (e) {
      if ((e as Error).message.includes('NOT_OWNER')) {
        setError('You can only view patterns for identities you own');
      } else {
        setError((e as Error).message ?? 'Failed to load patterns');
      }
    } finally {
      setBusyLoad(false);
    }
  };

  const setRepoPattern = async () => {
    setError(null);
    setSuccess(null);
    setTxHash(null);

    if (!validateForm()) return;
    if (!connected || !address) return setError('Connect wallet first');
    if (!resolverAddress) return setError('Resolver address not configured');

    try {
      setBusySet(true);

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error('No wallet client available');

      const hash = await walletClient.writeContract({
        address: resolverAddress,
        abi: UsernameUniqueResolverABI,
        functionName: 'setRepositoryPattern',
        args: [effectiveDomain, effectiveUsername, form.namespace, form.name, form.enabled],
        gas: BigInt(200000),
      });

      setTxHash(hash);

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      setSuccess(`Repository pattern ${form.enabled ? 'enabled' : 'disabled'} successfully!`);

      // Auto-load patterns after successful update
      setAutoLoadTriggered(false); // Reset to allow auto-reload
      await loadExistingPatterns();

    } catch (e) {
      if ((e as Error).message.includes('NOT_OWNER')) {
        setError('You can only set patterns for identities you own');
      } else if ((e as Error).message.includes('IDENTITY_NOT_FOUND')) {
        setError('Identity not found. Make sure you have an attestation for this domain/username combination');
      } else {
        setError((e as Error).message ?? 'Failed to set repository pattern');
      }
    } finally {
      setBusySet(false);
    }
  };

  const handleReset = () => {
    setForm({
      namespace: '*',
      name: '*',
      enabled: true,
    });
    setErrors({});
    setError(null);
    setSuccess(null);
    setTxHash(null);
  };

  const isLoading = busySet || busyLoad;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ p: 3, pb: 0 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Settings color="primary" fontSize="large" />
            <Typography variant="h5" fontWeight={600}>
              Repository Pattern Management
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure repository patterns to control which repositories can be indexed for attestations.
            Use wildcards (*) to match multiple repositories.
            <Tooltip title="Learn about pattern syntax" arrow>
              <IconButton size="small" sx={{ ml: 1 }}>
                <HelpOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </Typography>
        </Box>

        {/* Enhanced Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={viewMode}
            onChange={(_, newValue) => setViewMode(newValue)}
            aria-label="pattern management tabs"
            sx={{ px: 3 }}
          >
            <Tab
              value="set"
              label="Set Pattern"
              icon={<Add />}
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              value="list"
              label={
                <Badge badgeContent={existingPatterns.length} color="primary" showZero={false}>
                  View Patterns
                </Badge>
              }
              icon={<List />}
              iconPosition="start"
              sx={{ textTransform: 'none', fontWeight: 500 }}
            />
          </Tabs>
        </Box>

        {/* Loading Progress Bar */}
        {isLoading && (
          <LinearProgress sx={{ height: 2 }} />
        )}

        {/* Set Pattern Tab */}
        {viewMode === 'set' && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Namespace (Owner)"
                  placeholder="octocat or *"
                  value={form.namespace}
                  onChange={(e) => setForm({ ...form, namespace: e.target.value })}
                  error={!!errors.namespace}
                  helperText={errors.namespace || 'Repository owner/organization or * for wildcard'}
                  disabled={isLoading}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Repository Name"
                  placeholder="hello-world or *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  error={!!errors.name}
                  helperText={errors.name || 'Repository name or * for wildcard'}
                  disabled={isLoading}
                  variant="outlined"
                />
              </Grid>
            </Grid>

            {/* Pattern Preview */}
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Pattern Preview:
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Code fontSize="small" color="action" />
                <Box component="span" sx={{ color: form.enabled ? 'success.main' : 'text.disabled' }}>
                  {form.namespace}/{form.name}
                </Box>
                <Chip
                  label={form.enabled ? 'Enabled' : 'Disabled'}
                  color={form.enabled ? 'success' : 'default'}
                  size="small"
                />
              </Paper>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  disabled={isLoading}
                  color="primary"
                />
              }
              label={
                <Typography variant="body1" color={form.enabled ? 'text.primary' : 'text.secondary'}>
                  {form.enabled ? 'Enable this pattern' : 'Disable this pattern'}
                </Typography>
              }
              sx={{ mb: 3 }}
            />

            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={busySet ? <CircularProgress size={20} /> : <Add />}
                onClick={setRepoPattern}
                disabled={isLoading || !resolverReady || !connected}
                size="large"
                sx={{ flex: 1 }}
              >
                {busySet
                  ? (form.enabled ? 'Enabling Pattern...' : 'Disabling Pattern...')
                  : (form.enabled ? 'Enable Pattern' : 'Disable Pattern')
                }
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={isLoading}
                size="large"
              >
                Reset
              </Button>
            </Stack>

            {/* Enhanced Help Section */}
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Pattern Examples:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
                  <Typography component="li" variant="body2">
                    <Box component="code" sx={{ bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 }}>
                      octocat/hello-world
                    </Box>
                    {' '}- Specific repository
                  </Typography>
                  <Typography component="li" variant="body2">
                    <Box component="code" sx={{ bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 }}>
                      octocat/*
                    </Box>
                    {' '}- All repositories from octocat
                  </Typography>
                  <Typography component="li" variant="body2">
                    <Box component="code" sx={{ bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 }}>
                      */hello-world
                    </Box>
                    {' '}- hello-world repository from any owner
                  </Typography>
                  <Typography component="li" variant="body2">
                    <Box component="code" sx={{ bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 }}>
                      */*
                    </Box>
                    {' '}- All repositories (use with caution)
                  </Typography>
                </Box>
              </Box>
            </Alert>
          </Box>
        )}

        {/* View Patterns Tab */}
        {viewMode === 'list' && (
          <Box sx={{ p: 3 }}>
            {/* Refresh Button */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Typography variant="h6">
                Current Patterns
                {existingPatterns.length > 0 && (
                  <Chip
                    label={`${existingPatterns.length} pattern${existingPatterns.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                )}
              </Typography>
              <Button
                variant="outlined"
                startIcon={busyLoad ? <CircularProgress size={20} /> : <Refresh />}
                onClick={loadExistingPatterns}
                disabled={busyLoad || !resolverReady || !connected}
                size="small"
              >
                {busyLoad ? 'Loading...' : 'Refresh'}
              </Button>
            </Stack>

            {/* Loading Skeleton */}
            {busyLoad && existingPatterns.length === 0 && (
              <Stack spacing={2}>
                {[...Array(3)].map((_, index) => (
                  <Skeleton key={index} variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
            )}

            {/* Patterns List */}
            {existingPatterns.length > 0 && (
              <Stack spacing={2}>
                {existingPatterns.map((pattern, index) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{
                      p: 3,
                      bgcolor: pattern.enabled ? 'success.light' : 'action.hover',
                      borderColor: pattern.enabled ? 'success.main' : 'divider',
                      borderWidth: pattern.enabled ? 2 : 1,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        elevation: 2,
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={2}>
                        <Code color={pattern.enabled ? 'success' : 'action'} />
                        <Typography
                          variant="h6"
                          sx={{
                            fontFamily: 'monospace',
                            color: pattern.enabled ? 'success.dark' : 'text.secondary',
                            fontWeight: 500,
                          }}
                        >
                          {pattern.namespace}/{pattern.name}
                        </Typography>
                      </Box>
                      <Chip
                        label={pattern.enabled ? 'Enabled' : 'Disabled'}
                        color={pattern.enabled ? 'success' : 'default'}
                        variant={pattern.enabled ? 'filled' : 'outlined'}
                      />
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}

            {/* Empty State */}
            {existingPatterns.length === 0 && !busyLoad && effectiveDomain && effectiveUsername && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <List sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No patterns configured
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  You haven't set up any repository patterns yet.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setViewMode('set')}
                >
                  Create Your First Pattern
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Status Messages */}
        <Box sx={{ p: 3, pt: 0 }}>
          {!resolverReady && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuration Required
              </Typography>
              <Typography variant="body2">
                Resolver contract address is not configured. Add VITE_RESOLVER_ADDRESS to environment variables.
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {error.includes('IDENTITY_NOT_FOUND')
                  ? 'Identity Not Found'
                  : error.includes('NOT_OWNER')
                  ? 'Permission Denied'
                  : 'Operation Failed'}
              </Typography>
              <Typography variant="body2">
                {error.includes('IDENTITY_NOT_FOUND')
                  ? 'Make sure you have registered this GitHub identity first in the attestation section above.'
                  : error.includes('NOT_OWNER')
                  ? 'You can only manage patterns for GitHub identities that you own.'
                  : error}
              </Typography>
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Success!
              </Typography>
              <Typography variant="body2">
                {success}
              </Typography>
            </Alert>
          )}

          {txHash && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Transaction Submitted
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Your pattern update has been submitted to the blockchain.
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ p: 0, textTransform: 'none' }}
                >
                  View on BaseScan →
                </Button>
              </Box>
            </Alert>
          )}
        </Box>
      </Paper>
    </Container>
  );
};