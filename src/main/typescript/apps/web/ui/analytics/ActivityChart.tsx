import React, { useState } from 'react';
import { Box, Paper, Typography, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { TrendingUp, BarChart as BarChartIcon, ShowChart } from '@mui/icons-material';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import type { TimeRange, ChartDataPoint } from '../../hooks/useAnalytics';

type ViewMode = 'daily' | 'cumulative';
type DataType = 'commits' | 'identities' | 'both';

interface ActivityChartProps {
  identityData: ChartDataPoint[];
  commitData: ChartDataPoint[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  loading?: boolean;
}

const timeRangeLabels: Record<TimeRange, string> = {
  day: '24h',
  week: '7 days',
  month: '30 days',
  all: 'All Time'
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <Box
      sx={{
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 1,
        p: 1.5,
        minWidth: 120
      }}
    >
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {payload.map((entry: any, index: number) => (
        <Typography
          key={index}
          variant="body2"
          sx={{ color: entry.color, fontWeight: 500 }}
        >
          {entry.name}: {entry.value}
        </Typography>
      ))}
    </Box>
  );
};

export const ActivityChart: React.FC<ActivityChartProps> = ({
  identityData,
  commitData,
  timeRange,
  onTimeRangeChange,
  loading = false
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('cumulative');
  const [dataType, setDataType] = useState<DataType>('both');

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) setViewMode(newMode);
  };

  const handleDataTypeChange = (_: React.MouseEvent<HTMLElement>, newType: DataType | null) => {
    if (newType) setDataType(newType);
  };

  // Merge data for combined chart
  const mergedData = React.useMemo(() => {
    const dateMap = new Map<string, { 
      date: string; 
      displayDate: string;
      commitDaily: number;
      commitCumulative: number;
      identityDaily: number;
      identityCumulative: number;
    }>();

    for (const point of commitData) {
      dateMap.set(point.date, {
        date: point.date,
        displayDate: point.displayDate,
        commitDaily: point.daily,
        commitCumulative: point.cumulative,
        identityDaily: 0,
        identityCumulative: 0
      });
    }

    for (const point of identityData) {
      const existing = dateMap.get(point.date);
      if (existing) {
        existing.identityDaily = point.daily;
        existing.identityCumulative = point.cumulative;
      } else {
        dateMap.set(point.date, {
          date: point.date,
          displayDate: point.displayDate,
          commitDaily: 0,
          commitCumulative: 0,
          identityDaily: point.daily,
          identityCumulative: point.cumulative
        });
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [commitData, identityData]);

  const dataKey = viewMode === 'daily' ? 'Daily' : 'Cumulative';
  const showCommits = dataType === 'commits' || dataType === 'both';
  const showIdentities = dataType === 'identities' || dataType === 'both';

  const hasData = mergedData.length > 0;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp sx={{ color: '#00d4aa' }} />
          <Typography variant="h6" sx={{ color: 'white' }}>
            Activity Over Time
          </Typography>
        </Box>

        {/* Time Range Selector */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {(Object.keys(timeRangeLabels) as TimeRange[]).map((range) => (
            <Chip
              key={range}
              label={timeRangeLabels[range]}
              size="small"
              onClick={() => onTimeRangeChange(range)}
              sx={{
                bgcolor: timeRange === range ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.1)',
                color: timeRange === range ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(0,212,170,0.2)' }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.5)',
              borderColor: 'rgba(255,255,255,0.2)',
              '&.Mui-selected': {
                color: '#00d4aa',
                bgcolor: 'rgba(0,212,170,0.2)',
                '&:hover': { bgcolor: 'rgba(0,212,170,0.3)' }
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }
          }}
        >
          <ToggleButton value="daily">
            <BarChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Daily
          </ToggleButton>
          <ToggleButton value="cumulative">
            <ShowChart sx={{ mr: 0.5, fontSize: 18 }} />
            Cumulative
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Data Type Toggle */}
        <ToggleButtonGroup
          value={dataType}
          exclusive
          onChange={handleDataTypeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.5)',
              borderColor: 'rgba(255,255,255,0.2)',
              '&.Mui-selected': {
                color: '#00d4aa',
                bgcolor: 'rgba(0,212,170,0.2)',
                '&:hover': { bgcolor: 'rgba(0,212,170,0.3)' }
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }
          }}
        >
          <ToggleButton value="both">Both</ToggleButton>
          <ToggleButton value="commits">Commits</ToggleButton>
          <ToggleButton value="identities">Identities</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Chart */}
      <Box sx={{ height: 350, width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Loading...</Typography>
          </Box>
        ) : !hasData ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>No data for this time range</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'daily' ? (
              <BarChart data={mergedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  iconType="square"
                />
                {showCommits && (
                  <Bar
                    dataKey={`commit${dataKey}`}
                    name="Commits"
                    fill="#6c5ce7"
                    radius={[4, 4, 0, 0]}
                  />
                )}
                {showIdentities && (
                  <Bar
                    dataKey={`identity${dataKey}`}
                    name="Identities"
                    fill="#00d4aa"
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            ) : (
              <LineChart data={mergedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="displayDate"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  iconType="line"
                />
                {showCommits && (
                  <Line
                    type="monotone"
                    dataKey={`commit${dataKey}`}
                    name="Commits"
                    stroke="#6c5ce7"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#6c5ce7' }}
                  />
                )}
                {showIdentities && (
                  <Line
                    type="monotone"
                    dataKey={`identity${dataKey}`}
                    name="Identities"
                    stroke="#00d4aa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#00d4aa' }}
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
};
