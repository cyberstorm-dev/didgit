export function parseContributionDecodedJson(decodedJson: string): string | null {
  try {
    const decoded = JSON.parse(decodedJson);
    if (!Array.isArray(decoded)) return null;
    const field = decoded.find((d: any) => d.name === 'commitHash');
    const value = field?.value?.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    return value;
  } catch {
    return null;
  }
}

type FetchRecentAttestedCommitsArgs = {
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>;
  graphqlUrl: string;
  schemaUid: string;
  since: Date;
};

export async function fetchRecentAttestedCommits(args: FetchRecentAttestedCommitsArgs): Promise<Set<string>> {
  const sinceSeconds = Math.floor(args.since.getTime() / 1000);
  const query = `
    query {
      attestations(
        where: {
          schemaId: { equals: "${args.schemaUid}" }
          revoked: { equals: false }
          timeCreated: { gte: ${sinceSeconds} }
        }
      ) {
        decodedDataJson
      }
    }
  `;

  const res = await args.fetchFn(args.graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    throw new Error(`EAS GraphQL error: ${await res.text()}`);
  }

  const json = await res.json() as { data?: { attestations?: Array<{ decodedDataJson?: string }> } };
  const attestations = json.data?.attestations ?? [];
  const set = new Set<string>();

  for (const att of attestations) {
    const hash = parseContributionDecodedJson(att.decodedDataJson || '');
    if (hash) set.add(hash);
  }

  return set;
}
