export type ChartDataPoint = {
  date: string;
  count: number;
};

type Attestation = {
  id: string;
  time: number;
  decodedDataJson: string;
};

type Stats = {
  totalIdentities: number;
  totalCommits: number;
  totalRepos: number;
  identityChart: ChartDataPoint[];
  commitsChart: ChartDataPoint[];
};

const DEFAULT_TAKE = 100;
const DEFAULT_MAX_PAGES = 200;

export function getEasGraphqlEndpoint(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'https://base.easscan.org/graphql';
    case 84532:
      return 'https://base-sepolia.easscan.org/graphql';
    default:
      return 'https://base-sepolia.easscan.org/graphql';
  }
}

async function fetchAttestationsPage(
  endpoint: string,
  schemaId: string,
  skip: number,
  take: number,
  fetchFn: typeof fetch
): Promise<Attestation[]> {
  const query = `
    query GetAttestations($schemaId: String!, $skip: Int!, $take: Int!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
        orderBy: { time: asc }
        skip: $skip
        take: $take
      ) {
        id
        time
        decodedDataJson
      }
    }
  `;

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { schemaId, skip, take } })
  });

  if (!response.ok) {
    throw new Error(`EAS API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.data?.attestations ?? [];
}

export async function fetchAllAttestations(
  endpoint: string,
  schemaId: string,
  fetchFn: typeof fetch = fetch,
  take: number = DEFAULT_TAKE,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<Attestation[]> {
  const results: Attestation[] = [];
  let skip = 0;
  let page = 0;

  while (page < maxPages) {
    const pageResults = await fetchAttestationsPage(endpoint, schemaId, skip, take, fetchFn);
    results.push(...pageResults);

    if (pageResults.length < take) {
      break;
    }

    page += 1;
    skip += take;
  }

  return results;
}

export async function fetchStats(
  chainId: number,
  identitySchemaUid: string,
  contributionSchemaUid: string,
  fetchFn: typeof fetch = fetch
): Promise<Stats> {
  const endpoint = getEasGraphqlEndpoint(chainId);

  const [identities, contributions] = await Promise.all([
    fetchAllAttestations(endpoint, identitySchemaUid, fetchFn),
    fetchAllAttestations(endpoint, contributionSchemaUid, fetchFn)
  ]);

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

  const identityChart = buildCumulativeChart(
    Array.from(seenUsernames.values()).map((v) => v.time)
  );

  const commitsChart = buildCumulativeChart(commitTimes);

  return {
    totalIdentities: seenUsernames.size,
    totalCommits: contributions.length,
    totalRepos: uniqueRepos.size,
    identityChart,
    commitsChart
  };
}

export function buildCumulativeChart(timestamps: number[]): ChartDataPoint[] {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const dailyCounts = new Map<string, number>();
  let cumulative = 0;

  for (const time of sorted) {
    const date = new Date(time * 1000).toISOString().slice(0, 10);
    cumulative += 1;
    dailyCounts.set(date, cumulative);
  }

  return Array.from(dailyCounts.entries()).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count
  }));
}
