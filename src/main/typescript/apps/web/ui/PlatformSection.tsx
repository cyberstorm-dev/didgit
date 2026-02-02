import React, { useState } from 'react';
import { useGithubAuth } from '../auth/useGithub';
import { useGitlabAuth } from '../auth/useGitlab';
import { Button } from '../components/ui/button';

export type Platform = 'github' | 'gitlab';

export interface PlatformSectionProps {
  selectedPlatform?: Platform;
  onPlatformChange?: (platform: Platform) => void;
}

export const PlatformSection: React.FC<PlatformSectionProps> = ({
  selectedPlatform: controlledPlatform,
  onPlatformChange,
}) => {
  const [internalPlatform, setInternalPlatform] = useState<Platform>('github');
  const platform = controlledPlatform ?? internalPlatform;

  const github = useGithubAuth();
  const gitlab = useGitlabAuth();

  const handlePlatformChange = (p: Platform) => {
    if (onPlatformChange) {
      onPlatformChange(p);
    } else {
      setInternalPlatform(p);
    }
  };

  const ghClientId = (import.meta as any).env.VITE_GITHUB_CLIENT_ID as string | undefined;
  const glClientId = (import.meta as any).env.VITE_GITLAB_CLIENT_ID as string | undefined;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">Connect Platform</h3>

      {/* Platform Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-md w-fit">
        <button
          onClick={() => handlePlatformChange('github')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            platform === 'github'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          GitHub
        </button>
        <button
          onClick={() => handlePlatformChange('gitlab')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            platform === 'gitlab'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          GitLab
        </button>
      </div>

      {/* GitHub Panel */}
      {platform === 'github' && (
        <div>
          {!github.user ? (
            <div className="flex items-center gap-3">
              <Button onClick={github.connect} disabled={github.connecting || !ghClientId}>
                {github.connecting ? 'Connecting...' : 'Connect GitHub'}
              </Button>
              <span className="text-sm text-gray-500">Scopes: read:user, gist</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img
                src={github.user.avatar_url || undefined}
                alt={github.user.login}
                className="h-7 w-7 rounded-full"
              />
              <span>
                Logged in as <strong>{github.user.login}</strong>
              </span>
              <Button variant="ghost" onClick={github.disconnect}>
                Disconnect
              </Button>
            </div>
          )}
          {!github.user && (
            <div className="text-xs text-gray-500 mt-2">
              <div>
                Client ID: <code>{ghClientId ?? '—'}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GitLab Panel */}
      {platform === 'gitlab' && (
        <div>
          {!gitlab.user ? (
            <div className="flex items-center gap-3">
              <Button onClick={gitlab.connect} disabled={gitlab.connecting || !glClientId}>
                {gitlab.connecting ? 'Connecting...' : 'Connect GitLab'}
              </Button>
              <span className="text-sm text-gray-500">Scopes: read_user, api</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {gitlab.user.avatar_url && (
                <img
                  src={gitlab.user.avatar_url}
                  alt={gitlab.user.username}
                  className="h-7 w-7 rounded-full"
                />
              )}
              <span>
                Logged in as <strong>{gitlab.user.username}</strong>
              </span>
              <Button variant="ghost" onClick={gitlab.disconnect}>
                Disconnect
              </Button>
            </div>
          )}
          {!gitlab.user && (
            <div className="text-xs text-gray-500 mt-2">
              <div>
                Client ID: <code>{glClientId ?? '—'}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection status summary */}
      <div className="mt-4 text-xs text-gray-500">
        Connected:{' '}
        {github.user && <span className="text-green-600">GitHub ({github.user.login})</span>}
        {github.user && gitlab.user && ' | '}
        {gitlab.user && <span className="text-orange-600">GitLab ({gitlab.user.username})</span>}
        {!github.user && !gitlab.user && <span>None</span>}
      </div>
    </section>
  );
};

// Re-export for backward compatibility - maps to github-only view
export const GithubSection: React.FC = () => {
  const github = useGithubAuth();
  const ghClientId = (import.meta as any).env.VITE_GITHUB_CLIENT_ID as string | undefined;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">GitHub</h3>
      {!github.user ? (
        <div className="flex items-center gap-3">
          <Button onClick={github.connect} disabled={github.connecting}>
            Connect GitHub
          </Button>
          <span className="text-sm text-gray-500">Scopes: read:user, gist</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <img
            src={github.user.avatar_url || undefined}
            alt={github.user.login}
            className="h-7 w-7 rounded-full"
          />
          <span>
            Logged in as <strong>{github.user.login}</strong>
          </span>
          <Button variant="ghost" onClick={github.disconnect}>
            Disconnect
          </Button>
        </div>
      )}
      {!github.user && (
        <div className="text-xs text-gray-500 mt-2">
          <div>
            Client ID: <code>{ghClientId ?? '—'}</code>
          </div>
        </div>
      )}
    </section>
  );
};
