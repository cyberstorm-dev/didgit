import React, { useState } from 'react';
import { Container, Typography, Box, Paper, Chip, Link } from '@mui/material';
import { TrendingUp, GitHub } from '@mui/icons-material';
import { useAnalytics, type TimeRange } from '../hooks/useAnalytics';
import { ActivityChart, StatsSummary } from './analytics';
import { appConfig } from '../utils/config';

export const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const { totals, chartData, loading, error } = useAnalytics(timeRange);
  const config = appConfig();
  const isTestnet = config.CHAIN_ID === 84532;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <TrendingUp sx={{ color: '#00d4aa', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
            Registry Analytics
          </Typography>
          {isTestnet && (
            <Chip
              label="Testnet"
              size="small"
              sx={{
                bgcolor: 'rgba(255,193,7,0.2)',
                color: '#ffc107',
                fontSize: '0.75rem'
              }}
            />
          )}
        </Box>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Real-time statistics from the didgit.dev attestation registry on{' '}
          {isTestnet ? 'Base Sepolia (Testnet)' : 'Base'}.
        </Typography>
      </Box>

      {/* Stats Summary */}
      <Box sx={{ mb: 4 }}>
        <StatsSummary
          totals={totals}
          identityChartData={chartData.identities}
          commitChartData={chartData.commits}
          loading={loading}
          error={error}
        />
      </Box>

      {/* Activity Chart */}
      <Box sx={{ mb: 4 }}>
        <ActivityChart
          identityData={chartData.identities}
          commitData={chartData.commits}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          loading={loading}
        />
      </Box>

      {/* Additional Info */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
          About These Stats
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
          These statistics are pulled directly from the Ethereum Attestation Service (EAS) on Base.
          They represent on-chain attestations created through didgit.dev, linking GitHub identities
          to wallet addresses and recording verified commit contributions.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 3 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
              Identities
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Unique GitHub usernames with verified wallet attestations
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
              Commits
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Individual commit attestations linked to verified identities
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
              Repos
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Unique GitHub repositories with attested contributions
            </Typography>
          </Box>
        </Box>

        {/* Links */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mt: 3,
            pt: 2,
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <GitHub sx={{ color: 'rgba(255,255,255,0.5)' }} />
          <Box>
            <Link
              href="https://github.com/cyberstorm-dev/didgit"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: '#00d4aa',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              View Source on GitHub →
            </Link>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
              Open source attestation protocol
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};
