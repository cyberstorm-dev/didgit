import React from 'react';
import { useGithubAuth } from '../auth/useGithub';
import { Button } from '../components/ui/button';

export const GithubSection: React.FC = () => {
  const { user, connect, disconnect, connecting } = useGithubAuth();
  const clientId = (import.meta as any).env.VITE_GITHUB_CLIENT_ID as string | undefined;
  const redirectUri = (import.meta as any).env.VITE_GITHUB_REDIRECT_URI as string | undefined;
  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">GitHub</h3>
      {!user ? (
        <div className="flex items-center gap-3">
          <Button onClick={connect} disabled={connecting}>Connect GitHub</Button>
          <span className="text-sm text-gray-500">Scopes: read:user, gist</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <img src={user.avatar_url || undefined} alt={user.login} className="h-7 w-7 rounded-full" />
          <span>Logged in as <strong>{user.login}</strong></span>
          <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
        </div>
      )}
      {!user && (
        <div className="text-xs text-gray-500 mt-2">
          <div>Client ID: <code>{clientId ?? '—'}</code></div>
          <div>Redirect URI: <code>{redirectUri ?? window.location.origin}</code></div>
        </div>
      )}
    </section>
  );
};
