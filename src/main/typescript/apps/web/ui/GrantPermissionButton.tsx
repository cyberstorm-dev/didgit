import { useState } from 'react';
import { Button, Alert, CircularProgress, Box, Typography } from '@mui/material';
import { grantAttestationPermission, getPermissionInfo } from '../aa/permissions';
import type { ZeroDevAA } from '../aa/zerodev';

interface GrantPermissionButtonProps {
  aaClient?: ZeroDevAA;
  provider?: any;
  onPermissionGranted?: (permissionId: string) => void;
}

export function GrantPermissionButton({ aaClient, provider, onPermissionGranted }: GrantPermissionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGrantPermission = async () => {
    if (!provider) {
      setError('Wallet not connected');
      return;
    }

    if (!aaClient) {
      setError('Smart wallet not initialized');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const kernelAddress = await aaClient.getAddress();
      const permissionInfo = getPermissionInfo();

      const result = await grantAttestationPermission(provider, kernelAddress, permissionInfo);

      if (result.success && result.permissionId) {
        setSuccess(`Permission granted! ID: ${result.permissionId.slice(0, 10)}...`);
        onPermissionGranted?.(result.permissionId);
      } else {
        setError(result.error || 'Failed to grant permission');
      }
    } catch (e) {
      setError((e as Error).message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="h6" gutterBottom>
        Enable Automated Attestations
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Grant permission for the verifier service to automatically attest your commits.
        Your wallet will pay gas from your pre-funded balance.
      </Typography>

      <Button
        variant="contained"
        onClick={handleGrantPermission}
        disabled={loading || !provider || !aaClient}
        startIcon={loading && <CircularProgress size={20} />}
        sx={{ mt: 2 }}
      >
        {loading ? 'Granting Permission...' : 'Grant Permission'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
    </Box>
  );
}
