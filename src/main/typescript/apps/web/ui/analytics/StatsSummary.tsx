import React from 'react';
import { Box, Paper, Typography, Skeleton, Grid } from '@mui/material';
import { VerifiedUser, Code, FolderSpecial } from '@mui/icons-material';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { AnalyticsTotals, ChartDataPoint } from '../../hooks/useAnalytics';

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  loading: boolean;
  error: boolean;
  sparklineData?: ChartDataPoint[];
}

const StatItem: React.FC<StatItemProps> = ({
  icon,
  value,
  label,
  color,
  loading,
  error,
  sparklineData
}) => {
  const hasSparkline = sparklineData && sparklineData.length > 1;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        borderRadius: 1,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        minWidth: 0,
        flex: 1
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 1,
            bgcolor: `${color}15`
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {loading ? (
            <Skeleton variant="text" width={60} height={32} />
          ) : error ? (
            <Typography variant="h5" sx={{ color: '#ff6b6b', fontWeight: 'bold' }}>
              --
            </Typography>
          ) : (
            <Typography
              variant="h5"
              sx={{
                color: 'white',
                fontWeight: 'bold',
                lineHeight: 1.2
              }}
            >
              {value.toLocaleString()}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.6)',
              display: 'block',
              lineHeight: 1.2
            }}
          >
            {label}
          </Typography>
        </Box>
      </Box>

      {/* Mini Sparkline */}
      {hasSparkline && !loading && !error && (
        <Box sx={{ height: 30, width: '100%', mt: 0.5 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
};

interface StatsSummaryProps {
  totals: AnalyticsTotals;
  identityChartData?: ChartDataPoint[];
  commitChartData?: ChartDataPoint[];
  loading: boolean;
  error: string | null;
  compact?: boolean;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({
  totals,
  identityChartData,
  commitChartData,
  loading,
  error,
  compact = false
}) => {
  const hasError = !!error;

  return (
    <Paper
      elevation={compact ? 0 : 2}
      sx={{
        p: compact ? 0 : 2,
        background: compact ? 'transparent' : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: compact ? 'none' : '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <StatItem
            icon={<VerifiedUser sx={{ color: '#00d4aa', fontSize: 24 }} />}
            value={totals.identities}
            label="Verified Identities"
            color="#00d4aa"
            loading={loading}
            error={hasError}
            sparklineData={identityChartData}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatItem
            icon={<Code sx={{ color: '#6c5ce7', fontSize: 24 }} />}
            value={totals.commits}
            label="Commits Attested"
            color="#6c5ce7"
            loading={loading}
            error={hasError}
            sparklineData={commitChartData}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatItem
            icon={<FolderSpecial sx={{ color: '#fdcb6e', fontSize: 24 }} />}
            value={totals.repos}
            label="Unique Repos"
            color="#fdcb6e"
            loading={loading}
            error={hasError}
          />
        </Grid>
      </Grid>

      {error && !compact && (
        <Typography
          variant="caption"
          sx={{ color: '#ff6b6b', mt: 2, display: 'block' }}
        >
          Could not load stats: {error}
        </Typography>
      )}
    </Paper>
  );
};
