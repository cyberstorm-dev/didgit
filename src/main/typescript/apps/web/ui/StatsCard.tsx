import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Skeleton, Chip } from '@mui/material';
import { VerifiedUser, TrendingUp, GitHub } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { appConfig } from '../utils/config';

type ChartDataPoint = {
  date: string;
  count: number;
};

type Stats = {
  totalIdentities: number;
  chartData: ChartDataPoint[];
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

async function fetchStats(chainId: number): Promise<{ totalIdentities: number; chartData: ChartDataPoint[] }> {
  const endpoint = getEasGraphqlEndpoint(chainId);
  
  // Query for attestations with timestamps
  const query = `
    query GetAttestations($schemaId: String!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
        orderBy: { time: asc }
      ) {
        id
        time
        decodedDataJson
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
  const attestations = data?.data?.attestations ?? [];

  // Dedupe by username (same logic as RegistryBrowser)
  const seenUsernames = new Map<string, { time: number }>();
  for (const att of attestations) {
    let username = 'unknown';
    try {
      const decoded = JSON.parse(att.decodedDataJson);
      const usernameField = decoded.find((d: any) => d.name === 'username');
      if (usernameField?.value?.value) {
        username = usernameField.value.value;
      }
    } catch {}
    
    const existing = seenUsernames.get(username);
    if (!existing || att.time > existing.time) {
      seenUsernames.set(username, { time: att.time });
    }
  }

  // Build cumulative chart data by day
  const uniqueAttestations = Array.from(seenUsernames.values()).sort((a, b) => a.time - b.time);
  const dailyCounts = new Map<string, number>();
  let cumulative = 0;
  
  for (const att of uniqueAttestations) {
    const date = new Date(att.time * 1000).toISOString().split('T')[0];
    cumulative++;
    dailyCounts.set(date, cumulative);
  }

  const chartData: ChartDataPoint[] = Array.from(dailyCounts.entries()).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count
  }));

  return {
    totalIdentities: seenUsernames.size,
    chartData
  };
}

export const StatsCard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalIdentities: 0,
    chartData: [],
    loading: true,
    error: null
  });

  const config = appConfig();

  useEffect(() => {
    fetchStats(config.CHAIN_ID)
      .then(({ totalIdentities, chartData }) => {
        setStats({
          totalIdentities,
          chartData,
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

      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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

        {/* Chart */}
        {!stats.loading && stats.chartData.length > 0 && (
          <Box sx={{ flex: 1, minWidth: 200, height: 80 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  tickLine={false}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1a1a2e', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 4
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  itemStyle={{ color: '#00d4aa' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#00d4aa" 
                  strokeWidth={2}
                  dot={{ fill: '#00d4aa', r: 4 }}
                  name="Identities"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

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
