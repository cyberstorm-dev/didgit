import React from 'react';

export const App: React.FC = () => {
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
              <p>Dune dashboards will live here. Replace with an embed when ready.</p>
            </div>
            <div className="dune-grid">
              <div className="dune-card">
                <div className="dune-title">Identity attestations</div>
                <div className="dune-placeholder">Dune chart embed</div>
              </div>
              <div className="dune-card">
                <div className="dune-title">Commit attestations</div>
                <div className="dune-placeholder">Dune chart embed</div>
              </div>
              <div className="dune-card">
                <div className="dune-title">Active verified developers</div>
                <div className="dune-placeholder">Dune chart embed</div>
              </div>
            </div>
            <div className="dune-note">
              Placeholder: replace the cards above with a Dune iframe embed.
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
