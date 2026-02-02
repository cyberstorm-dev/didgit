import React, { useEffect, useState } from 'react';
import { 
  Paper, Typography, Box, Skeleton, Chip, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Avatar
} from '@mui/material';
import { EmojiEvents, Code, FolderSpecial, Person } from '@mui/icons-material';
import { appConfig } from '../utils/config';

type LeaderboardEntry = {
  rank: number;
  name: string;
  count: number;
};

type LeaderboardData = {
  topRepos: LeaderboardEntry[];
  topAccounts: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
};

type TimeRange = 'all' | 'week' | 'month';

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

const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782';
const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';

async function fetchLeaderboards(chainId: number, _timeRange: TimeRange): Promise<Omit<LeaderboardData, 'loading' | 'error'>> {
  const endpoint = getEasGraphqlEndpoint(chainId);
  
  // Fetch contributions and identities to properly aggregate by user
  const contributionQuery = `
    query GetContributions($schemaId: String!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
      ) {
        id
        time
        recipient
        decodedDataJson
      }
    }
  `;

  const identityQuery = `
    query GetIdentities($schemaId: String!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
      ) {
        recipient
        decodedDataJson
      }
    }
  `;

  const [contribRes, identityRes] = await Promise.all([
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: contributionQuery, variables: { schemaId: CONTRIBUTION_SCHEMA_UID } })
    }),
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: identityQuery, variables: { schemaId: IDENTITY_SCHEMA_UID } })
    })
  ]);

  if (!contribRes.ok || !identityRes.ok) {
    throw new Error(`EAS API error`);
  }

  const [contribData, identityData] = await Promise.all([contribRes.json(), identityRes.json()]);
  const attestations = contribData?.data?.attestations ?? [];
  const identities = identityData?.data?.attestations ?? [];

  // Build address -> username mapping from identities
  const addressToUsername = new Map<string, string>();
  for (const id of identities) {
    try {
      const decoded = JSON.parse(id.decodedDataJson);
      const username = decoded.find((d: any) => d.name === 'username')?.value?.value;
      if (username && id.recipient) {
        addressToUsername.set(id.recipient.toLowerCase(), username);
      }
    } catch {}
  }

  // Count by repo
  const repoCounts = new Map<string, number>();
  // Count by recipient address (normalized to username)
  const accountCounts = new Map<string, number>();

  for (const att of attestations) {
    try {
      const decoded = JSON.parse(att.decodedDataJson);
      
      const repoField = decoded.find((d: any) => d.name === 'repo');
      if (repoField?.value?.value) {
        const repo = repoField.value.value;
        repoCounts.set(repo, (repoCounts.get(repo) || 0) + 1);
      }

      // Use recipient address to look up canonical username
      const recipient = att.recipient?.toLowerCase();
      const username = addressToUsername.get(recipient) || 
        decoded.find((d: any) => d.name === 'author')?.value?.value ||
        'unknown';
      accountCounts.set(username, (accountCounts.get(username) || 0) + 1);
    } catch {}
  }

  // Sort and take top 10
  const topRepos = Array.from(repoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count], i) => ({ rank: i + 1, name, count }));

  const topAccounts = Array.from(accountCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count], i) => ({ rank: i + 1, name, count }));

  return { topRepos, topAccounts };
}

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const colors: Record<number, string> = {
    1: '#FFD700', // Gold
    2: '#C0C0C0', // Silver
    3: '#CD7F32', // Bronze
  };
  const color = colors[rank] || 'rgba(255,255,255,0.3)';
  
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: rank <= 3 ? `${color}22` : 'transparent',
        border: `2px solid ${color}`,
        fontWeight: 'bold',
        fontSize: 12,
        color: color
      }}
    >
      {rank}
    </Box>
  );
};

const LeaderboardTable: React.FC<{ 
  data: LeaderboardEntry[]; 
  loading: boolean;
  icon: React.ReactNode;
  nameLabel: string;
}> = ({ data, loading, icon, nameLabel }) => {
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          No data yet
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)', width: 50 }}>
              Rank
            </TableCell>
            <TableCell sx={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {icon}
                {nameLabel}
              </Box>
            </TableCell>
            <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.1)', width: 80 }}>
              Commits
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((entry) => (
            <TableRow 
              key={entry.name}
              sx={{ 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                '& td': { borderColor: 'rgba(255,255,255,0.05)' }
              }}
            >
              <TableCell>
                <RankBadge rank={entry.rank} />
              </TableCell>
              <TableCell>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}
                >
                  {entry.name}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Chip 
                  label={entry.count} 
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(0,212,170,0.2)', 
                    color: '#00d4aa',
                    fontWeight: 'bold'
                  }} 
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export const Leaderboards: React.FC = () => {
  const [data, setData] = useState<LeaderboardData>({
    topRepos: [],
    topAccounts: [],
    loading: true,
    error: null
  });
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [tab, setTab] = useState(0);

  const config = appConfig();

  useEffect(() => {
    setData(prev => ({ ...prev, loading: true }));
    fetchLeaderboards(config.CHAIN_ID, timeRange)
      .then((result) => {
        setData({
          ...result,
          loading: false,
          error: null
        });
      })
      .catch((err) => {
        console.error('Failed to fetch leaderboards:', err);
        setData(prev => ({
          ...prev,
          loading: false,
          error: err.message
        }));
      });
  }, [config.CHAIN_ID, timeRange]);

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        mb: 3,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEvents sx={{ color: '#FFD700' }} />
            <Typography variant="h6" sx={{ color: 'white' }}>
              Leaderboards
            </Typography>
          </Box>
          
          {/* Time Range Selector - placeholder for now */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label="All Time" 
              size="small"
              onClick={() => setTimeRange('all')}
              sx={{ 
                bgcolor: timeRange === 'all' ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.1)',
                color: timeRange === 'all' ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(0,212,170,0.2)' }
              }} 
            />
            <Chip 
              label="This Week" 
              size="small"
              disabled
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'not-allowed'
              }} 
            />
            <Chip 
              label="This Month" 
              size="small"
              disabled
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'not-allowed'
              }} 
            />
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs 
        value={tab} 
        onChange={(_, v) => setTab(v)}
        sx={{ 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          '& .MuiTab-root': { 
            color: 'rgba(255,255,255,0.5)',
            '&.Mui-selected': { color: '#00d4aa' }
          },
          '& .MuiTabs-indicator': { bgcolor: '#00d4aa' }
        }}
      >
        <Tab 
          icon={<FolderSpecial sx={{ fontSize: 18 }} />} 
          iconPosition="start" 
          label="Top Repos" 
          sx={{ minHeight: 48 }}
        />
        <Tab 
          icon={<Person sx={{ fontSize: 18 }} />} 
          iconPosition="start" 
          label="Top Contributors" 
          sx={{ minHeight: 48 }}
        />
      </Tabs>

      {/* Content */}
      <Box sx={{ minHeight: 300 }}>
        {tab === 0 && (
          <LeaderboardTable
            data={data.topRepos}
            loading={data.loading}
            icon={<FolderSpecial sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />}
            nameLabel="Repository"
          />
        )}
        {tab === 1 && (
          <LeaderboardTable
            data={data.topAccounts}
            loading={data.loading}
            icon={<Person sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />}
            nameLabel="Contributor"
          />
        )}
      </Box>

      {data.error && (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="caption" sx={{ color: '#ff6b6b' }}>
            Error loading leaderboards: {data.error}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
