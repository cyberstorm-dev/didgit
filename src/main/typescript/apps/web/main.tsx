import React from 'react';
import './polyfills/webcrypto';
import { createRoot } from 'react-dom/client';
import { AppMUI } from './ui/AppMUI';
import { GithubAuthProvider } from './auth/useGithub';
import { GitlabAuthProvider } from './auth/useGitlab';
import { Web3AuthProvider } from './web3auth/Web3AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { WalletProvider } from './wallet/WalletContext';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('Root element not found');
createRoot(el).render(
  <ThemeProvider>
    <Web3AuthProvider>
      <WalletProvider>
        <GithubAuthProvider>
          <GitlabAuthProvider>
            <AppMUI />
          </GitlabAuthProvider>
        </GithubAuthProvider>
      </WalletProvider>
    </Web3AuthProvider>
  </ThemeProvider>
);
