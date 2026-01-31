import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { appConfig } from '../utils/config';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert } from '../components/ui/alert';
import { Card, CardContent } from '../components/ui/card';

const inputSchema = z.object({ q: z.string().min(1) });

type AttestationItem = {
  id: string;
  recipient: string;
  decoded: {
    github_username: string;
    wallet_address: string;
    github_proof_url: string;
    wallet_signature: string;
  } | null;
};

const EAS_GQL = 'https://base-sepolia.easscan.org/graphql';

export const VerifyPanel: React.FC = () => {
  const cfg = useMemo(() => appConfig(), []);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AttestationItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const parsed = inputSchema.safeParse({ q });
    if (!parsed.success) return;
    setError(null);
    setItems(null);
    setBusy(true);
    try {
      const query = `query ($schemaId: String!, $q: String!) {
        attestations(take: 20, where: { schemaId: { equals: $schemaId }, OR: [
          { decodedDataJson: { contains: $q } },
          { recipient: { equals: $q } }
        ] }) {
          id
          recipient
          decodedDataJson
        }
      }`;
      const resp = await fetch(EAS_GQL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables: { schemaId: cfg.EAS_SCHEMA_UID, q: parsed.data.q } }),
      });
      const json = await resp.json();
      const list: AttestationItem[] = (json.data?.attestations ?? []).map((a: any) => ({
        id: a.id,
        recipient: a.recipient,
        decoded: safeParseDecoded(a.decodedDataJson),
      }));
      setItems(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">Verify</h3>
      <div className="flex gap-2">
        <Input placeholder="Search by username, wallet or URL" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={search} disabled={busy}>Search</Button>
      </div>
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
      {items && (
        <div className="grid gap-2 mt-2">
          {items.length === 0 && (
            <div>No results.</div>
          )}
          {items.map((it) => (
            <Card key={it.id}>
              <CardContent>
                <div><strong>Attestation:</strong> <a className="text-blue-600 underline" href={`https://base-sepolia.easscan.org/attestation/view/${it.id}`} target="_blank" rel="noreferrer">{it.id}</a></div>
                <div className="text-sm">Recipient: <code>{it.recipient}</code></div>
                {it.decoded && (
                  <div className="mt-1 text-sm">
                    <div>Username: <code>{it.decoded.github_username}</code></div>
                    <div>Wallet: <code>{it.decoded.wallet_address}</code></div>
                    <div>Gist: <a className="text-blue-600 underline" href={it.decoded.github_proof_url} target="_blank" rel="noreferrer">{it.decoded.github_proof_url}</a></div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

function safeParseDecoded(decodedDataJson: string | null | undefined): AttestationItem['decoded'] {
  if (!decodedDataJson) return null;
  try {
    const rows = JSON.parse(decodedDataJson) as Array<{ name: string; type: string; value: { type: string; value: any } }>;
    const map = new Map<string, any>();
    for (const r of rows) map.set(r.name, r.value?.value);
    const payload = {
      github_username: String(map.get('github_username') ?? ''),
      wallet_address: String(map.get('wallet_address') ?? ''),
      github_proof_url: String(map.get('github_proof_url') ?? ''),
      wallet_signature: String(map.get('wallet_signature') ?? ''),
    };
    if (!payload.github_username || !payload.wallet_address) return null;
    return payload;
  } catch {
    return null;
  }
}
