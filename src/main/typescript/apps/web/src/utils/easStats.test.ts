import { describe, it, expect, vi } from 'vitest';
import { fetchAllAttestations, fetchStats } from '../../utils/easStats';

type FetchCall = {
  url: string;
  variables: { schemaId: string; skip: number; take: number };
};

function makeAttestations(count: number, startTime = 1, repoPrefix = 'repo'): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `att-${startTime + i}`,
    time: startTime + i,
    decodedDataJson: JSON.stringify([
      { name: 'repo', value: { value: `${repoPrefix}-${i % 3}` } }
    ])
  }));
}

describe('fetchAllAttestations', () => {
  it('paginates until a short page is returned', async () => {
    const calls: FetchCall[] = [];
    const fetchFn = vi.fn(async (url: any, init: any) => {
      const body = JSON.parse(init.body as string);
      const variables = body.variables as FetchCall['variables'];
      calls.push({ url, variables });

      let attestations: any[] = [];
      if (variables.skip === 0) {
        attestations = makeAttestations(100, 1);
      } else if (variables.skip === 100) {
        attestations = makeAttestations(40, 101);
      }

      return {
        ok: true,
        json: async () => ({ data: { attestations } })
      } as Response;
    });

    const result = await fetchAllAttestations('https://example.com/graphql', 'schema-1', fetchFn, 100, 10);

    expect(result).toHaveLength(140);
    expect(calls.map((c) => c.variables.skip)).toEqual([0, 100]);
  });
});

describe('fetchStats', () => {
  it('aggregates totals from all pages', async () => {
    const identitySchema = 'identity-schema';
    const contributionSchema = 'contrib-schema';

    const fetchFn = vi.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body as string);
      const { schemaId, skip } = body.variables as { schemaId: string; skip: number };

      if (schemaId === identitySchema) {
        const identitiesPage1 = [
          {
            id: 'id-1',
            time: 1,
            decodedDataJson: JSON.stringify([{ name: 'username', value: { value: 'alice' } }])
          },
          {
            id: 'id-2',
            time: 2,
            decodedDataJson: JSON.stringify([{ name: 'username', value: { value: 'bob' } }])
          }
        ];
        const identitiesPage2 = [
          {
            id: 'id-3',
            time: 3,
            decodedDataJson: JSON.stringify([{ name: 'username', value: { value: 'alice' } }])
          }
        ];

        const attestations = skip === 0 ? identitiesPage1 : identitiesPage2;
        return {
          ok: true,
          json: async () => ({ data: { attestations } })
        } as Response;
      }

      if (schemaId === contributionSchema) {
        const page1 = makeAttestations(100, 10, 'repo');
        const page2 = makeAttestations(20, 110, 'repo');
        const attestations = skip === 0 ? page1 : page2;
        return {
          ok: true,
          json: async () => ({ data: { attestations } })
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: { attestations: [] } })
      } as Response;
    });

    const stats = await fetchStats(8453, identitySchema, contributionSchema, fetchFn);

    expect(stats.totalIdentities).toBe(2);
    expect(stats.totalCommits).toBe(120);
    expect(stats.totalRepos).toBe(3);
    expect(stats.identityChart.length).toBeGreaterThan(0);
    expect(stats.commitsChart.length).toBeGreaterThan(0);
  });
});
