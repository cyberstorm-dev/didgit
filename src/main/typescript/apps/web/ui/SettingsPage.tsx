import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Alert,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
} from '@mui/material';
import { ExpandMore, Settings, GitHub } from '@mui/icons-material';
import { useWallet } from '../wallet/WalletContext';
import { useGithubAuth } from '../auth/useGithub';
import { RepoManagerMUI } from './RepoManagerMUI';
import { appConfig } from '../utils/config';

// This would ideally come from a service that queries the blockchain
// For now, we'll use a simple state-based approach
interface GitHubIdentity {
  domain: string;
  username: string;
  attestationUid: string;
  verified: boolean;
}

export const SettingsPage: React.FC = () => {
  const { connected, address } = useWallet();
  const { user } = useGithubAuth();
  const [identities, setIdentities] = useState<GitHubIdentity[]>([]);
  const [loading, setLoading] = useState(false);
  const cfg = useMemo(() => appConfig(), []);

  // Query EAS for real attestations made by this wallet address
  const loadIdentities = async () => {
    if (!connected || !address) return;

    setLoading(true);
    try {
      const EAS_GQL = 'https://base-sepolia.easscan.org/graphql';
      const query = `query ($schemaId: String!, $recipient: String!) {
        attestations(take: 50, where: {
          schemaId: { equals: $schemaId },
          recipient: { equals: $recipient }
        }) {
          id
          recipient
          decodedDataJson
        }
      }`;

      const resp = await fetch(EAS_GQL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: {
            schemaId: cfg.EAS_SCHEMA_UID,
            recipient: address
          }
        }),
      });

      const json = await resp.json();
      const attestations = json.data?.attestations ?? [];

      const identities: GitHubIdentity[] = attestations
        .map((a: any) => {
          const decoded = safeParseDecoded(a.decodedDataJson);
          if (!decoded?.github_username) return null;

          return {
            domain: 'github.com',
            username: decoded.github_username,
            attestationUid: a.id,
            verified: true,
          };
        })
        .filter(Boolean);

      setIdentities(identities);
    } catch (error) {
      console.error('Failed to load identities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse EAS decoded data (copied from VerifyPanel)
  function safeParseDecoded(decodedDataJson: string | null | undefined) {
    if (!decodedDataJson) return null;
    try {
      const rows = JSON.parse(decodedDataJson) as Array<{ name: string; type: string; value: { type: string; value: any } }>;
      const map = new Map<string, any>();
      for (const r of rows) map.set(r.name, r.value?.value);
      const payload = {
        github_username: String(map.get('github_username') ?? ''),
        wallet_address: String(map.get('wallet_address') ?? ''),
        github_proof_url: String(map.get('github_proof_url') ?? ''),
        wallet_signature: String(map.get('wallet_signature') ?? ''),
      };
      if (!payload.github_username || !payload.wallet_address) return null;
      return payload;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    loadIdentities();
  }, [connected, address]);

  if (!connected) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            Connect Your Wallet
          </Typography>
          <Typography variant="body2">
            Please connect your wallet using the button in the top-right corner to manage your GitHub identity settings.
          </Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <Settings color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={600}>
          GitHub Identity Settings
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage repository patterns for your verified GitHub identities. Configure which repositories
        should be indexed for attestations.
      </Typography>

      {/* Loading State */}
      {loading && (
        <Box display="flex" alignItems="center" gap={2} sx={{ mb: 4 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading your GitHub identities...
          </Typography>
        </Box>
      )}

      {/* No Identities */}
      {!loading && connected && identities.length === 0 && (
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            No GitHub Identities Found
          </Typography>
          <Typography variant="body2">
            You haven't registered any GitHub identities yet.
            Go to the Register page to create your first attestation.
          </Typography>
        </Alert>
      )}

      {/* Identity List */}
      {!loading && identities.length > 0 && (
        <Stack spacing={3}>
          <Typography variant="h6">
            Your Registered Identities ({identities.length})
          </Typography>

          {identities.map((identity, index) => (
            <Accordion key={`${identity.domain}-${identity.username}`} elevation={2}>
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 2
                  }
                }}
              >
                <GitHub color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6">
                    {identity.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {identity.domain}
                  </Typography>
                </Box>
                <Chip
                  label={identity.verified ? 'Verified' : 'Pending'}
                  color={identity.verified ? 'success' : 'warning'}
                  size="small"
                />
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ pt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Configure repository patterns for {identity.username}@{identity.domain}.
                    These patterns determine which repositories will be indexed for attestations.
                  </Typography>

                  {/* Repository Pattern Management */}
                  <RepoManagerMUI
                    domain={identity.domain}
                    username={identity.username}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      {/* Information Section */}
      <Paper elevation={1} sx={{ p: 3, mt: 4, bgcolor: 'info.light', color: 'info.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          Repository Pattern Information
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Default Pattern:</strong> All new identities start with <code>*/*</code> (all repositories enabled)
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Wildcard Support:</strong> Use <code>*</code> to match any namespace or repository name
          </Typography>
          <Typography component="li" variant="body2" sx={{ mb: 1 }}>
            <strong>Specific Patterns:</strong> Use exact names like <code>myorg/myrepo</code> for precise control
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Pattern Priority:</strong> More specific patterns take precedence over wildcards
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};