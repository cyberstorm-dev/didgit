import { useEffect, useState, useCallback, useRef } from 'react';
import { appConfig } from '../utils/config';

// Schema UIDs from existing code
export const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';
export const CONTRIBUTION_SCHEMA_UID = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782';

export type TimeRange = 'day' | 'week' | 'month' | 'all';

export type ChartDataPoint = {
  date: string;
  displayDate: string;
  daily: number;
  cumulative: number;
};

export type AnalyticsTotals = {
  identities: number;
  commits: number;
  repos: number;
};

export type AnalyticsChartData = {
  identities: ChartDataPoint[];
  commits: ChartDataPoint[];
};

export type AnalyticsData = {
  totals: AnalyticsTotals;
  chartData: AnalyticsChartData;
  loading: boolean;
  error: string | null;
};

type RawAttestation = {
  id: string;
  time: number;
  recipient?: string;
  decodedDataJson: string;
};

// Cache for EAS data to avoid redundant fetches
type CacheEntry = {
  data: {
    identities: RawAttestation[];
    contributions: RawAttestation[];
  };
  timestamp: number;
};

const cache = new Map<number, CacheEntry>();
const CACHE_TTL = 60000; // 1 minute cache

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

function getTimeRangeFilter(timeRange: TimeRange): number {
  const now = Math.floor(Date.now() / 1000);
  switch (timeRange) {
    case 'day':
      return now - 86400; // 24 hours
    case 'week':
      return now - 604800; // 7 days
    case 'month':
      return now - 2592000; // 30 days
    case 'all':
    default:
      return 0;
  }
}

async function fetchRawData(chainId: number): Promise<CacheEntry['data']> {
  // Check cache
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const endpoint = getEasGraphqlEndpoint(chainId);

  const identityQuery = `
    query GetIdentities($schemaId: String!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
        orderBy: { time: asc }
      ) {
        id
        time
        recipient
        decodedDataJson
      }
    }
  `;

  const contributionQuery = `
    query GetContributions($schemaId: String!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
        orderBy: { time: asc }
      ) {
        id
        time
        recipient
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
    throw new Error('EAS API error');
  }

  const [identityData, contributionData] = await Promise.all([
    identityRes.json(),
    contributionRes.json()
  ]);

  const data = {
    identities: identityData?.data?.attestations ?? [],
    contributions: contributionData?.data?.attestations ?? []
  };

  // Update cache
  cache.set(chainId, { data, timestamp: Date.now() });

  return data;
}

function processIdentities(identities: RawAttestation[], minTime: number): { 
  count: number; 
  timestamps: number[] 
} {
  const seenUsernames = new Map<string, number>();

  for (const att of identities) {
    if (att.time < minTime && minTime > 0) continue;

    let username = 'unknown';
    try {
      const decoded = JSON.parse(att.decodedDataJson);
      const usernameField = decoded.find((d: any) => d.name === 'username');
      if (usernameField?.value?.value) {
        username = usernameField.value.value;
      }
    } catch {}

    const existing = seenUsernames.get(username);
    if (!existing || att.time > existing) {
      seenUsernames.set(username, att.time);
    }
  }

  return {
    count: seenUsernames.size,
    timestamps: Array.from(seenUsernames.values())
  };
}

function processContributions(contributions: RawAttestation[], minTime: number): {
  commitCount: number;
  repoCount: number;
  timestamps: number[];
} {
  const uniqueRepos = new Set<string>();
  const timestamps: number[] = [];
  let commitCount = 0;

  for (const att of contributions) {
    if (att.time < minTime && minTime > 0) continue;

    commitCount++;
    timestamps.push(att.time);

    try {
      const decoded = JSON.parse(att.decodedDataJson);
      const repoField = decoded.find((d: any) => d.name === 'repo');
      if (repoField?.value?.value) {
        uniqueRepos.add(repoField.value.value);
      }
    } catch {}
  }

  return {
    commitCount,
    repoCount: uniqueRepos.size,
    timestamps
  };
}

function buildChartData(timestamps: number[], timeRange: TimeRange): ChartDataPoint[] {
  if (timestamps.length === 0) return [];

  const sorted = [...timestamps].sort((a, b) => a - b);
  const dailyCounts = new Map<string, number>();

  // Group by date
  for (const time of sorted) {
    const date = new Date(time * 1000).toISOString().split('T')[0];
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  }

  // Fill in missing dates if timeRange is specific
  const dates = Array.from(dailyCounts.keys()).sort();
  if (dates.length === 0) return [];

  let startDate: Date;
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  switch (timeRange) {
    case 'day':
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'week':
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'all':
    default:
      startDate = new Date(dates[0]);
      break;
  }

  // Build filled array
  const result: ChartDataPoint[] = [];
  let cumulative = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const daily = dailyCounts.get(dateStr) || 0;
    cumulative += daily;

    result.push({
      date: dateStr,
      displayDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daily,
      cumulative
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}

export function useAnalytics(timeRange: TimeRange = 'all'): AnalyticsData & { refetch: () => void } {
  const [data, setData] = useState<AnalyticsData>({
    totals: { identities: 0, commits: 0, repos: 0 },
    chartData: { identities: [], commits: [] },
    loading: true,
    error: null
  });

  const config = appConfig();
  const fetchIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    
    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const rawData = await fetchRawData(config.CHAIN_ID);
      
      // Check if this fetch is still valid
      if (currentFetchId !== fetchIdRef.current) return;

      const minTime = getTimeRangeFilter(timeRange);

      const identityStats = processIdentities(rawData.identities, minTime);
      const contributionStats = processContributions(rawData.contributions, minTime);

      const identityChartData = buildChartData(identityStats.timestamps, timeRange);
      const commitChartData = buildChartData(contributionStats.timestamps, timeRange);

      setData({
        totals: {
          identities: identityStats.count,
          commits: contributionStats.commitCount,
          repos: contributionStats.repoCount
        },
        chartData: {
          identities: identityChartData,
          commits: commitChartData
        },
        loading: false,
        error: null
      });
    } catch (err) {
      if (currentFetchId !== fetchIdRef.current) return;
      
      console.error('Failed to fetch analytics:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }));
    }
  }, [config.CHAIN_ID, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}

// Export helper function for external use
export { getEasGraphqlEndpoint };
