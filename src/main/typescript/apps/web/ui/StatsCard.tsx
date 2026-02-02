import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Skeleton, Chip, Grid } from '@mui/material';
import { VerifiedUser, TrendingUp, GitHub, Code, FolderSpecial } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { appConfig } from '../utils/config';

type ChartDataPoint = {
  date: string;
  count: number;
};

type Stats = {
  totalIdentities: number;
  totalCommits: number;
  totalRepos: number;
  identityChart: ChartDataPoint[];
  commitsChart: ChartDataPoint[];
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

// Schema UIDs
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';
const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782';

async function fetchStats(chainId: number): Promise<Omit<Stats, 'loading' | 'error'>> {
  const endpoint = getEasGraphqlEndpoint(chainId);
  
  // Query for identity attestations
  const identityQuery = `
    query GetIdentities($schemaId: String!) {
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

  // Query for contribution attestations  
  const contributionQuery = `
    query GetContributions($schemaId: String!) {
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

  const [identityRes, contributionRes] = await Promise.all([
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: identityQuery, variables: { schemaId: IDENTITY_SCHEMA_UID } })
    }),
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: contributionQuery, variables: { schemaId: CONTRIBUTION_SCHEMA_UID } })
    })
  ]);

  if (!identityRes.ok || !contributionRes.ok) {
    throw new Error(`EAS API error`);
  }

  const [identityData, contributionData] = await Promise.all([
    identityRes.json(),
    contributionRes.json()
  ]);

  const identities = identityData?.data?.attestations ?? [];
  const contributions = contributionData?.data?.attestations ?? [];

  // Process identities - dedupe by username
  const seenUsernames = new Map<string, { time: number }>();
  for (const att of identities) {
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

  // Process contributions - extract repos
  const uniqueRepos = new Set<string>();
  const commitTimes: number[] = [];
  
  for (const att of contributions) {
    commitTimes.push(att.time);
    try {
      const decoded = JSON.parse(att.decodedDataJson);
      const repoField = decoded.find((d: any) => d.name === 'repo');
      if (repoField?.value?.value) {
        uniqueRepos.add(repoField.value.value);
      }
    } catch {}
  }

  // Build identity chart (cumulative by day)
  const identityChart = buildCumulativeChart(
    Array.from(seenUsernames.values()).map(v => v.time)
  );

  // Build commits chart (cumulative by day)
  const commitsChart = buildCumulativeChart(commitTimes);

  return {
    totalIdentities: seenUsernames.size,
    totalCommits: contributions.length,
    totalRepos: uniqueRepos.size,
    identityChart,
    commitsChart
  };
}

function buildCumulativeChart(timestamps: number[]): ChartDataPoint[] {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const dailyCounts = new Map<string, number>();
  let cumulative = 0;
  
  for (const time of sorted) {
    const date = new Date(time * 1000).toISOString().split('T')[0];
    cumulative++;
    dailyCounts.set(date, cumulative);
  }

  return Array.from(dailyCounts.entries()).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count
  }));
}

type StatBoxProps = {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  loading: boolean;
  error: boolean;
  chartData?: ChartDataPoint[];
  chartColor?: string;
};

const StatBox: React.FC<StatBoxProps> = ({ icon, value, label, loading, error, chartData, chartColor = '#00d4aa' }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 140 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon}
      <Box>
        {loading ? (
          <Skeleton variant="text" width={50} height={36} />
        ) : error ? (
          <Typography variant="h5" sx={{ color: '#ff6b6b' }}>--</Typography>
        ) : (
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
            {value}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {label}
        </Typography>
      </Box>
    </Box>
    {chartData && chartData.length > 1 && (
      <Box sx={{ height: 50, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke={chartColor} 
              strokeWidth={2}
              dot={false}
            />
            <Tooltip 
              contentStyle={{ 
                background: '#1a1a2e', 
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                fontSize: 12
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              itemStyle={{ color: chartColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    )}
  </Box>
);

export const StatsCard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalIdentities: 0,
    totalCommits: 0,
    totalRepos: 0,
    identityChart: [],
    commitsChart: [],
    loading: true,
    error: null
  });

  const config = appConfig();

  useEffect(() => {
    fetchStats(config.CHAIN_ID)
      .then((data) => {
        setStats({
          ...data,
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
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

      <Grid container spacing={3}>
        {/* Verified Identities */}
        <Grid item xs={12} sm={4}>
          <StatBox
            icon={<VerifiedUser sx={{ color: '#00d4aa', fontSize: 32 }} />}
            value={stats.totalIdentities}
            label="Verified Identities"
            loading={stats.loading}
            error={!!stats.error}
            chartData={stats.identityChart}
            chartColor="#00d4aa"
          />
        </Grid>

        {/* Commits Attested */}
        <Grid item xs={12} sm={4}>
          <StatBox
            icon={<Code sx={{ color: '#6c5ce7', fontSize: 32 }} />}
            value={stats.totalCommits}
            label="Commits Attested"
            loading={stats.loading}
            error={!!stats.error}
            chartData={stats.commitsChart}
            chartColor="#6c5ce7"
          />
        </Grid>

        {/* Unique Repos */}
        <Grid item xs={12} sm={4}>
          <StatBox
            icon={<FolderSpecial sx={{ color: '#fdcb6e', fontSize: 32 }} />}
            value={stats.totalRepos}
            label="Unique Repos"
            loading={stats.loading}
            error={!!stats.error}
          />
        </Grid>
      </Grid>

      {/* GitHub Link */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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

      {stats.error && (
        <Typography variant="caption" sx={{ color: '#ff6b6b', mt: 2, display: 'block' }}>
          Could not load stats: {stats.error}
        </Typography>
      )}
    </Paper>
  );
};
