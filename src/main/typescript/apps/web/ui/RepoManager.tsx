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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Chip,
  Stack,
  Paper,
  Grid,
} from '@mui/material';
import { Settings, Add, Info, Visibility, List } from '@mui/icons-material';
import { z } from 'zod';
import { useWallet } from '../wallet/WalletContext';
import { useGithubAuth } from '../auth/useGithub';
import { appConfig } from '../utils/config';
import { UsernameUniqueResolverABI, type RepositoryPattern, validateDomain, validateUsername, validateNamespace, validateRepoName } from '@git-attest/abi';
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
  domain: string;
  username: string;
  namespace: string;
  name: string;
  enabled: boolean;
}

export const RepoManager: React.FC = () => {
  const { address, smartAddress, connected, getWalletClient } = useWallet();
  const { user } = useGithubAuth();
  const cfg = useMemo(() => appConfig(), []);

  // Form state
  const [form, setForm] = useState<RepoPatternForm>({
    domain: 'github.com',
    username: '',
    namespace: '',
    name: '',
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

  const resolverAddress = cfg.RESOLVER_ADDRESS as `0x${string}` | undefined;
  const resolverReady = !!resolverAddress;

  // Pre-fill username from GitHub auth
  useEffect(() => {
    if (user?.login) setForm((f) => ({ ...f, username: user.login }));
  }, [user?.login]);

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http()
    });
  }, []);

  const validateForm = () => {
    const newErrors: Partial<RepoPatternForm> = {};

    if (!form.domain) {
      newErrors.domain = 'Domain is required';
    } else if (!validateDomain(form.domain)) {
      newErrors.domain = 'Invalid domain format';
    }

    if (!form.username) {
      newErrors.username = 'Username is required';
    } else if (!validateUsername(form.username)) {
      newErrors.username = 'Invalid username format';
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
    if (!connected || !address || !resolverAddress || !form.domain || !form.username) return;

    try {
      setBusyLoad(true);
      setError(null);

      const patterns = await publicClient.readContract({
        address: resolverAddress,
        abi: UsernameUniqueResolverABI,
        functionName: 'getRepositoryPatterns',
        args: [form.domain, form.username],
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
        functionName: 'setRepoPattern',
        args: [form.domain, form.username, form.namespace, form.name, form.enabled],
        gas: BigInt(200000),
      });

      setTxHash(hash);

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      setSuccess(`Repository pattern ${form.enabled ? 'enabled' : 'disabled'} successfully!`);

      // Auto-load patterns after successful update
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
      domain: 'github.com',
      username: user?.login || '',
      namespace: '',
      name: '',
      enabled: true,
    });
    setErrors({});
    setError(null);
    setSuccess(null);
    setTxHash(null);
  };

  const isLoading = busySet || busyLoad;

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Settings color="primary" />
        <Typography variant="h6">Repository Pattern Management</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        Configure repository patterns to control which repositories can be indexed for attestations.
        Use wildcards (*) to match multiple repositories.
      </Typography>

      {/* Mode Toggle */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant={viewMode === 'set' ? 'contained' : 'outlined'}
          onClick={() => setViewMode('set')}
          startIcon={<Add />}
          sx={{ mr: 1 }}
        >
          Set Pattern
        </Button>
        <Button
          variant={viewMode === 'list' ? 'contained' : 'outlined'}
          onClick={() => setViewMode('list')}
          startIcon={<List />}
        >
          View Patterns
        </Button>
      </Box>

      {viewMode === 'set' && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Box component="form" sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Domain"
                    placeholder="github.com"
                    value={form.domain}
                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    error={!!errors.domain}
                    helperText={errors.domain || 'Platform hosting the repository'}
                    disabled={isLoading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    placeholder="your-username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    error={!!errors.username}
                    helperText={errors.username || 'Must match your registered identity'}
                    disabled={isLoading || !!user?.login}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }}>
                <Chip label="Repository Pattern" size="small" />
              </Divider>

              <Grid container spacing={2}>
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
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    disabled={isLoading}
                  />
                }
                label={form.enabled ? 'Enable this pattern' : 'Disable this pattern'}
                sx={{ mt: 2, mb: 2 }}
              />

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={isLoading ? <CircularProgress size={20} /> : <Add />}
                  onClick={setRepoPattern}
                  disabled={isLoading || !resolverReady || !connected}
                  fullWidth
                >
                  {isLoading ? 'Processing...' : form.enabled ? 'Enable Pattern' : 'Disable Pattern'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  Reset
                </Button>
              </Stack>
            </Box>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Box display="flex" alignItems="flex-start" gap={1}>
                <Info fontSize="small" />
                <Box>
                  <Typography variant="body2">
                    <strong>Pattern Examples:</strong>
                  </Typography>
                  <Typography variant="body2" component="div">
                    • <code>octocat/hello-world</code> - Specific repository
                    <br />
                    • <code>octocat/*</code> - All repositories from octocat
                    <br />
                    • <code>*/hello-world</code> - hello-world repository from any owner
                    <br />
                    • <code>*/*</code> - All repositories (use with caution)
                  </Typography>
                </Box>
              </Box>
            </Alert>
          </CardContent>
        </Card>
      )}

      {viewMode === 'list' && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Domain"
                  placeholder="github.com"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  disabled={isLoading}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Username"
                  placeholder="your-username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={isLoading || !!user?.login}
                />
              </Grid>
            </Grid>

            <Button
              variant="outlined"
              startIcon={busyLoad ? <CircularProgress size={20} /> : <Visibility />}
              onClick={loadExistingPatterns}
              disabled={busyLoad || !resolverReady || !connected}
              sx={{ mb: 2 }}
            >
              {busyLoad ? 'Loading...' : 'Load Patterns'}
            </Button>

            {existingPatterns.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Current Patterns:
                </Typography>
                <Stack spacing={1}>
                  {existingPatterns.map((pattern, index) => (
                    <Paper
                      key={index}
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: pattern.enabled ? 'success.light' : 'grey.100',
                        borderColor: pattern.enabled ? 'success.main' : 'grey.300',
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" component="code">
                          {pattern.namespace}/{pattern.name}
                        </Typography>
                        <Chip
                          label={pattern.enabled ? 'Enabled' : 'Disabled'}
                          color={pattern.enabled ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {existingPatterns.length === 0 && !busyLoad && form.domain && form.username && (
              <Alert severity="info">
                No patterns found for this identity. Switch to "Set Pattern" to add some.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {!resolverReady && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Resolver contract address is not configured. Add VITE_RESOLVER_ADDRESS to environment variables.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {error.includes('IDENTITY_NOT_FOUND')
              ? 'Identity not found. Make sure you have registered this identity first.'
              : error.includes('NOT_OWNER')
              ? 'You can only manage patterns for your own identities.'
              : `Error: ${error}`}
          </Typography>
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {success}
          </Typography>
        </Alert>
      )}

      {txHash && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Transaction submitted: <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              {txHash}
            </a>
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};