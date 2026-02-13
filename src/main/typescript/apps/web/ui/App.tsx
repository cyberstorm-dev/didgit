import React, { useEffect, useMemo, useState } from 'react';

type LeaderboardRow = {
  username: string;
  wallet: string;
  commits: number;
  identityUid: string;
};

const EAS_GRAPHQL = 'https://base.easscan.org/graphql';
const IDENTITY_SCHEMA = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';
const CONTRIBUTION_SCHEMA = '0x7425c71616d2959f30296d8e013a8fd23320145b1dfda0718ab0a692087f8782';
const PAGE_SIZE = 200;
const IDENTITY_LIMIT = 2000;
const CONTRIBUTION_LIMIT = 5000;

const identityQuery = `
query AllIdentities($take: Int!, $skip: Int!) {
  attestations(
    where: {
      schemaId: { equals: "${IDENTITY_SCHEMA}" }
      revoked: { equals: false }
    }
    orderBy: { time: desc }
    take: $take
    skip: $skip
  ) {
    id
    recipient
    decodedDataJson
  }
}
`;

const contributionQuery = `
query AllContributions($take: Int!, $skip: Int!) {
  attestations(
    where: {
      schemaId: { equals: "${CONTRIBUTION_SCHEMA}" }
      revoked: { equals: false }
    }
    orderBy: { time: desc }
    take: $take
    skip: $skip
  ) {
    id
    refUID
    time
  }
}
`;

const shortenAddress = (value: string) => {
  if (!value) return '';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

const parseDecodedData = (decoded: string) => {
  try {
    const items = JSON.parse(decoded);
    if (!Array.isArray(items)) return null;
    const result: Record<string, string> = {};
    for (const entry of items) {
      if (!entry || typeof entry !== 'object') continue;
      const name = entry.name;
      const value = entry.value?.value;
      if (typeof name === 'string' && typeof value === 'string') {
        result[name] = value;
      }
    }
    return result;
  } catch {
    return null;
  }
};

const fetchGraphQL = async (query: string, variables: Record<string, number>, signal: AbortSignal) => {
  const res = await fetch(EAS_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal
  });
  if (!res.ok) {
    throw new Error(`EAS GraphQL error: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message ?? 'EAS GraphQL error');
  }
  return json.data?.attestations ?? [];
};

export const App: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLeaderboardStatus('loading');
      setLeaderboardError(null);
      try {
        const identityMap = new Map<string, { username: string; wallet: string }>();
        for (let skip = 0; skip < IDENTITY_LIMIT; skip += PAGE_SIZE) {
          const rows = await fetchGraphQL(identityQuery, { take: PAGE_SIZE, skip }, controller.signal);
          if (!rows.length) break;
          for (const row of rows) {
            const decoded = row.decodedDataJson;
            if (!decoded) continue;
            const data = parseDecodedData(decoded);
            if (!data?.username) continue;
            const wallet = data.wallet || row.recipient;
            if (!wallet) continue;
            identityMap.set(String(row.id).toLowerCase(), {
              username: data.username,
              wallet
            });
          }
        }

        const counts = new Map<string, number>();
        for (let skip = 0; skip < CONTRIBUTION_LIMIT; skip += PAGE_SIZE) {
          const rows = await fetchGraphQL(contributionQuery, { take: PAGE_SIZE, skip }, controller.signal);
          if (!rows.length) break;
          for (const row of rows) {
            const ref = String(row.refUID || '').toLowerCase();
            if (!ref) continue;
            counts.set(ref, (counts.get(ref) ?? 0) + 1);
          }
        }

        const rows: LeaderboardRow[] = [];
        for (const [uid, commits] of counts.entries()) {
          const identity = identityMap.get(uid);
          if (!identity) continue;
          rows.push({
            username: identity.username,
            wallet: identity.wallet,
            commits,
            identityUid: uid
          });
        }

        rows.sort((a, b) => b.commits - a.commits);
        setLeaderboard(rows.slice(0, 25));
        setLeaderboardStatus('idle');
      } catch (err) {
        if (!controller.signal.aborted) {
          setLeaderboardStatus('error');
          setLeaderboardError(err instanceof Error ? err.message : 'Failed to load leaderboard');
        }
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const leaderboardMeta = useMemo(() => {
    if (leaderboardStatus === 'loading') return 'Loading live data…';
    if (leaderboardStatus === 'error') return 'Live data unavailable';
    if (!leaderboard.length) return 'No data yet';
    return `Top ${leaderboard.length} by total commit attestations`;
  }, [leaderboard.length, leaderboardStatus]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand">didgit.dev</div>
          <nav className="topbar-actions">
            <a className="pill" href="#dune">Stats</a>
            <a className="pill" href="#quickstart">Quickstart</a>
            <a
              className="btn btn-primary"
              href="https://github.com/cyberstorm-dev/didgit/blob/main/skills/didgit-onboarding/SKILL.md"
              target="_blank"
              rel="noreferrer"
            >
              Open SKILL.md
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="kicker">Identity for humans + agents</div>
              <h1>
                Verify GitHub ↔ wallet identity with on-chain attestations,
                without a dapp.
              </h1>
              <p>
                didgit is an agent-first onboarding flow that links a GitHub username
                to a wallet address using EAS attestations. Simple, composable,
                and portable across chains.
              </p>
              <div className="hero-actions">
                <a
                  className="btn btn-primary"
                  href="https://github.com/cyberstorm-dev/didgit/blob/main/skills/didgit-onboarding/SKILL.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Start in SKILL.md
                </a>
                <a className="btn btn-ghost" href="#quickstart">Read quickstart</a>
              </div>
              <div className="hero-meta">
                <span>Default chain: Base mainnet</span>
                <span>Also supported: Arbitrum One</span>
              </div>
            </div>
            <div className="hero-card">
              <div className="hero-card-label">What you get</div>
              <ul>
                <li>On-chain proof you control GitHub + wallet</li>
                <li>Portable reputation for agents and builders</li>
                <li>Commit attestations tied to verified identity</li>
              </ul>
              <div className="hero-card-footer">
                <span>Time: ~5 minutes</span>
                <span>Gas: minimal</span>
              </div>
            </div>
          </div>
        </section>

        <section id="dune" className="section">
          <div className="container">
            <div className="section-header">
              <h2>Network Stats</h2>
              <p>Live Dune snapshots (WIP).</p>
            </div>
            <div className="dune-grid">
              <div className="dune-card">
                <div className="dune-title">Total verified developers</div>
                <iframe
                  className="dune-embed"
                  title="Total verified developers"
                  src="https://dune.com/embeds/6692291/10537755?darkMode=true"
                  loading="lazy"
                />
              </div>
              <div className="dune-card">
                <div className="dune-title">Cumulative commit attestations</div>
                <iframe
                  className="dune-embed"
                  title="Cumulative commit attestations"
                  src="https://dune.com/embeds/6692325/10537837?darkMode=true"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="dune-note">
              Seeing a blocked embed? Add didgit.dev to the Dune embed allowlist.
            </div>
            <div className="leaderboard">
              <div className="leaderboard-header">
                <div>
                  <h3>Leaderboard</h3>
                  <p>{leaderboardMeta}</p>
                </div>
                <span className="leaderboard-pill">Live</span>
              </div>
              {leaderboardStatus === 'error' ? (
                <div className="leaderboard-empty">{leaderboardError}</div>
              ) : (
                <div className="leaderboard-table">
                  <div className="leaderboard-row leaderboard-head">
                    <span>#</span>
                    <span>Username</span>
                    <span>Wallet</span>
                    <span>Commits</span>
                  </div>
                  {leaderboard.map((row, idx) => (
                    <div className="leaderboard-row" key={row.identityUid}>
                      <span>{idx + 1}</span>
                      <span>{row.username}</span>
                      <span title={row.wallet}>{shortenAddress(row.wallet)}</span>
                      <span>{row.commits}</span>
                    </div>
                  ))}
                  {!leaderboard.length && leaderboardStatus !== 'loading' && (
                    <div className="leaderboard-empty">No leaderboard data yet.</div>
                  )}
                  {leaderboardStatus === 'loading' && (
                    <div className="leaderboard-empty">Loading live leaderboard…</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="quickstart" className="section section-alt">
          <div className="container">
            <div className="section-header">
              <h2>Quickstart (Human-Readable)</h2>
              <p>A distilled version of the onboarding SKILL.md for humans.</p>
            </div>
            <div className="steps">
              <div className="step-card">
                <div className="step-title">1) Prepare identity</div>
                <p>Set your GitHub username and wallet address.</p>
                <pre>
                  <code>
{`export GITHUB_USERNAME="your-handle"
export WALLET_ADDRESS="0xYourWallet"
export MESSAGE="github.com:$GITHUB_USERNAME"`}
                  </code>
                </pre>
              </div>
              <div className="step-card">
                <div className="step-title">2) Sign message</div>
                <p>Sign the exact message with your wallet key.</p>
                <pre>
                  <code>{`export SIGNATURE=$(cast wallet sign --private-key $PRIVATE_KEY "$MESSAGE")`}</code>
                </pre>
              </div>
              <div className="step-card">
                <div className="step-title">3) Create proof gist</div>
                <p>Publish a public `didgit-proof.json` gist with your signature.</p>
                <pre>
                  <code>{`export GIST_URL="https://gist.github.com/you/..."`}</code>
                </pre>
              </div>
              <div className="step-card">
                <div className="step-title">4) Attest identity</div>
                <p>Run the backend flow to submit the identity attestation.</p>
                <pre>
                  <code>{`pnpm run attest:identity`}</code>
                </pre>
              </div>
              <div className="step-card">
                <div className="step-title">5) Permission + kernel</div>
                <p>Generate permission blob and register session key.</p>
                <pre>
                  <code>{`pnpm run permission:setup`}</code>
                </pre>
              </div>
              <div className="step-card">
                <div className="step-title">6) Register repos</div>
                <p>Set your repo globs for commit attestations.</p>
                <pre>
                  <code>{`pnpm run repo:register`}</code>
                </pre>
              </div>
            </div>
            <div className="cta-row">
              <a
                className="btn btn-primary"
                href="https://github.com/cyberstorm-dev/didgit/blob/main/skills/didgit-onboarding/SKILL.md"
                target="_blank"
                rel="noreferrer"
              >
                Full SKILL.md
              </a>
              <a className="btn btn-ghost" href="https://github.com/cyberstorm-dev/didgit" target="_blank" rel="noreferrer">
                Repo
              </a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2>Why this matters</h2>
              <p>Identity is the primitive. Without it, agents can’t carry reputation.</p>
            </div>
            <div className="callout-grid">
              <div className="callout">
                <h3>Portable reputation</h3>
                <p>Attestations let you prove ownership across ecosystems.</p>
              </div>
              <div className="callout">
                <h3>Composable verification</h3>
                <p>Any app can verify identity with EAS attestations.</p>
              </div>
              <div className="callout">
                <h3>Agent-first workflow</h3>
                <p>No UI friction. Automate onboarding in minutes.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span>didgit.dev</span>
          <span>On-chain identity for builders and agents</span>
        </div>
      </footer>
    </div>
  );
};
