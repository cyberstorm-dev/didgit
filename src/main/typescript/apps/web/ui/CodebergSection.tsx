import React, { useState } from 'react';
import { useCodebergAuth } from '../auth/useCodeberg';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export const CodebergSection: React.FC = () => {
  const { user, connect, disconnect, connecting, customHost, setCustomHost, domain } = useCodebergAuth();
  const clientId = (import.meta as any).env.VITE_CODEBERG_CLIENT_ID as string | undefined;
  const redirectUri = (import.meta as any).env.VITE_CODEBERG_REDIRECT_URI as string | undefined;
  
  const [useCustomHost, setUseCustomHost] = useState(!!customHost);
  const [hostInput, setHostInput] = useState(customHost || '');

  const handleConnect = async () => {
    const host = useCustomHost && hostInput.trim() ? hostInput.trim() : undefined;
    await connect(host);
  };

  const handleToggleCustomHost = (checked: boolean) => {
    setUseCustomHost(checked);
    if (!checked) {
      setCustomHost(null);
      setHostInput('');
    }
  };

  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHostInput(value);
    if (value.trim()) {
      setCustomHost(value.trim());
    }
  };

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">Codeberg / Gitea</h3>
      {!user ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button onClick={handleConnect} disabled={connecting || !clientId}>
              {connecting ? 'Connecting…' : `Connect ${useCustomHost && hostInput ? hostInput : 'Codeberg'}`}
            </Button>
            <span className="text-sm text-gray-500">Scopes: read:user, write:misc</span>
          </div>
          
          {/* Self-hosted Gitea option */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-custom-host"
              checked={useCustomHost}
              onChange={(e) => handleToggleCustomHost(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="use-custom-host" className="text-sm text-gray-600">
              Use self-hosted Gitea instance
            </label>
          </div>
          
          {useCustomHost && (
            <div className="pl-6">
              <label className="text-sm text-gray-600 block mb-1">Gitea Host (e.g., gitea.example.com)</label>
              <Input
                type="text"
                value={hostInput}
                onChange={handleHostChange}
                placeholder="gitea.example.com"
                className="max-w-xs"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter just the hostname, without https:// prefix
              </p>
            </div>
          )}
          
          {!clientId && (
            <div className="text-xs text-red-500">
              VITE_CODEBERG_CLIENT_ID is not set. Configure OAuth app in .env
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            <div>Client ID: <code>{clientId ?? '—'}</code></div>
            <div>Redirect URI: <code>{redirectUri ?? window.location.origin}</code></div>
            <div>Target: <code>{useCustomHost && hostInput ? hostInput : 'codeberg.org'}</code></div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {user.avatar_url && (
              <img src={user.avatar_url} alt={user.login} className="h-7 w-7 rounded-full" />
            )}
            <span>
              Logged in as <strong>{user.login}</strong>
              <span className="text-gray-500 text-sm ml-1">on {domain}</span>
            </span>
            <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
          </div>
          {customHost && (
            <div className="text-xs text-gray-500">
              Self-hosted Gitea: <code>{customHost}</code>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
