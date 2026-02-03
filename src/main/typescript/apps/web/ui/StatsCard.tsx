import React from 'react';
import { Paper, Typography, Box, Skeleton, Chip, Grid } from '@mui/material';
import { VerifiedUser, TrendingUp, GitHub, Code, FolderSpecial } from '@mui/icons-material';
import { LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { useAnalytics, type ChartDataPoint } from '../hooks/useAnalytics';
import { appConfig } from '../utils/config';

type StatBoxProps = {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  loading: boolean;
  error: boolean;
  chartData?: { date: string; count: number }[];
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

// Transform ChartDataPoint[] to format expected by StatBox
function toChartData(data: ChartDataPoint[]): { date: string; count: number }[] {
  return data.map(point => ({
    date: point.displayDate,
    count: point.cumulative
  }));
}

export const StatsCard: React.FC = () => {
  const { totals, chartData, loading, error } = useAnalytics('all');
  const config = appConfig();
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
            value={totals.identities}
            label="Verified Identities"
            loading={loading}
            error={!!error}
            chartData={toChartData(chartData.identities)}
            chartColor="#00d4aa"
          />
        </Grid>

        {/* Commits Attested */}
        <Grid item xs={12} sm={4}>
          <StatBox
            icon={<Code sx={{ color: '#6c5ce7', fontSize: 32 }} />}
            value={totals.commits}
            label="Commits Attested"
            loading={loading}
            error={!!error}
            chartData={toChartData(chartData.commits)}
            chartColor="#6c5ce7"
          />
        </Grid>

        {/* Unique Repos */}
        <Grid item xs={12} sm={4}>
          <StatBox
            icon={<FolderSpecial sx={{ color: '#fdcb6e', fontSize: 32 }} />}
            value={totals.repos}
            label="Unique Repos"
            loading={loading}
            error={!!error}
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

      {error && (
        <Typography variant="caption" sx={{ color: '#ff6b6b', mt: 2, display: 'block' }}>
          Could not load stats: {error}
        </Typography>
      )}
    </Paper>
  );
};
