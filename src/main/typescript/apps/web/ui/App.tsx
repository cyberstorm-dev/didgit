import React, { useMemo, useState } from 'react';
import { WalletSection } from './WalletSection';
import { GithubSection } from './GithubSection';
import { CodebergSection } from './CodebergSection';
import { AttestForm } from './AttestForm';
import { VerifyPanel } from './VerifyPanel';
import { appConfig } from '../utils/config';
import { RepoManager } from './RepoManager';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export const App: React.FC = () => {
  const cfg = useMemo(() => appConfig(), []);
  const [activeTab, setActiveTab] = useState<'attest' | 'verify'>('attest');

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Developer Identity Attestation</h1>
          <span className="text-sm text-gray-500">Base Sepolia</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="text-xs text-gray-500">Base Sepolia Schema UID: {cfg.EAS_SCHEMA_UID}</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          <Card><CardContent><WalletSection /></CardContent></Card>
          <Card><CardContent><GithubSection /></CardContent></Card>
          <Card><CardContent><CodebergSection /></CardContent></Card>
        </div>

        <div className="mt-4">
          <AttestForm />
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Flow</h3>
          <ol className="list-decimal pl-6 space-y-1 text-sm text-gray-700">
            <li>Connect wallet (BYOW). Privy path can be added later.</li>
            <li>Connect GitHub or Codeberg/Gitea.</li>
            <li>Sign your username with your wallet.</li>
            <li>Create a proof Gist and submit attestation.</li>
          </ol>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Repository Patterns</h3>
          <p className="text-sm text-gray-600 mb-2">Manage repos to index for your identity (requires contract address).</p>
          <div className="border rounded p-3">
            <RepoManager />
          </div>
        </div>

        <div className="mt-6">
          <details>
            <summary className="cursor-pointer text-sm text-gray-600">Open verification search</summary>
            <div className="mt-3">
              <VerifyPanel />
            </div>
          </details>
        </div>
      </main>
    </div>
  );
};
