import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Skeleton, Chip } from '@mui/material';
import { VerifiedUser, TrendingUp, GitHub } from '@mui/icons-material';
import { appConfig } from '../utils/config';

type Stats = {
  totalIdentities: number;
  totalContributions: number;
  loading: boolean;
  error: string | null;
};

// EAS GraphQL endpoint based on chain
function getEasGraphqlEndpoint(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'https://base.easscan.org/graphql';
    case 84532:
      return 'https://base-sepolia.easscan.org/graphql';
    default:
      return 'https://base-sepolia.easscan.org/graphql';
  }
}

// Identity schema UID (same across chains for didgit)
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';

async function fetchStats(chainId: number): Promise<{ totalIdentities: number; totalContributions: number }> {
  const endpoint = getEasGraphqlEndpoint(chainId);
  
  // Query for attestation count by schema
  const query = `
    query GetAttestationCount($schemaId: String!) {
      aggregateAttestation(where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }) {
        _count {
          _all
        }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { schemaId: IDENTITY_SCHEMA_UID }
    })
  });

  if (!response.ok) {
    throw new Error(`EAS API error: ${response.status}`);
  }

  const data = await response.json();
  const count = data?.data?.aggregateAttestation?._count?._all ?? 0;

  return {
    totalIdentities: count,
    totalContributions: 0 // TODO: Query contribution schema when needed
  };
}

export const StatsCard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalIdentities: 0,
    totalContributions: 0,
    loading: true,
    error: null
  });

  const config = appConfig();

  useEffect(() => {
    fetchStats(config.CHAIN_ID)
      .then(({ totalIdentities, totalContributions }) => {
        setStats({
          totalIdentities,
          totalContributions,
          loading: false,
          error: null
        });
      })
      .catch((err) => {
        console.error('Failed to fetch stats:', err);
        setStats(prev => ({
          ...prev,
          loading: false,
          error: err.message
        }));
      });
  }, [config.CHAIN_ID]);

  const isTestnet = config.CHAIN_ID === 84532;

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3, 
        mb: 4, 
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TrendingUp sx={{ color: '#00d4aa' }} />
        <Typography variant="h6" sx={{ color: 'white' }}>
          Registry Stats
        </Typography>
        {isTestnet && (
          <Chip 
            label="Testnet" 
            size="small" 
            sx={{ 
              bgcolor: 'rgba(255,193,7,0.2)', 
              color: '#ffc107',
              fontSize: '0.7rem'
            }} 
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {/* Identity Count */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <VerifiedUser sx={{ color: '#00d4aa', fontSize: 40 }} />
          <Box>
            {stats.loading ? (
              <Skeleton variant="text" width={60} height={40} />
            ) : stats.error ? (
              <Typography variant="h4" sx={{ color: '#ff6b6b' }}>--</Typography>
            ) : (
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                {stats.totalIdentities}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Verified Identities
            </Typography>
          </Box>
        </Box>

        {/* GitHub Link */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
          <GitHub sx={{ color: 'rgba(255,255,255,0.5)' }} />
          <Box>
            <Typography 
              variant="body2" 
              component="a"
              href="https://github.com/cyberstorm-dev/didgit/tree/main/skills/didgit-onboarding"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                color: '#00d4aa', 
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              Agent Onboarding →
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
              Register via CLI in 5 minutes
            </Typography>
          </Box>
        </Box>
      </Box>

      {stats.error && (
        <Typography variant="caption" sx={{ color: '#ff6b6b', mt: 1, display: 'block' }}>
          Could not load stats: {stats.error}
        </Typography>
      )}
    </Paper>
  );
};
