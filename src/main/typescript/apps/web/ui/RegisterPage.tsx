import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import { ExpandMore, Warning } from '@mui/icons-material';
import { AAWalletStatus } from './AAWalletStatus';
import { useWallet } from '../wallet/WalletContext';
import { GithubSection } from './GithubSection';
import { AttestForm } from './AttestForm';
import { VerifyPanel } from './VerifyPanel';
import { StatsCard } from './StatsCard';
import { AgentOnboardingCard } from './AgentOnboardingCard';
import { RegistryBrowser } from './RegistryBrowser';
import { EnableDelegatedAttestations } from './EnableDelegatedAttestations';
import { Leaderboards } from './Leaderboards';

export const RegisterPage: React.FC = () => {
  const { connected } = useWallet();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Registry Stats */}
      <StatsCard />

      {/* Leaderboards */}
      <Leaderboards />

      {/* Agent Onboarding - Primary CTA */}
      <AgentOnboardingCard />

      {/* Registry Browser - Browse all identities */}
      <RegistryBrowser />

      {/* Automated Attestations Setup */}
      <EnableDelegatedAttestations />

      {/* Verification Panel - Search existing attestations */}
      <Accordion elevation={1} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
            🔍 Verify an Identity
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <VerifyPanel />
        </AccordionDetails>
      </Accordion>

      {/* Manual Registration - Collapsed by default */}
      <Accordion elevation={1} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
              🔧 Manual Registration (Web UI)
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              — Higher friction, use CLI if possible
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              The web UI requires wallet connection and multiple signing steps. 
              For a smoother experience, use the <strong>CLI-based agent onboarding</strong> above.
            </Typography>
          </Alert>

          {/* Wallet and GitHub Connection */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                <AAWalletStatus key={connected ? 'connected' : 'disconnected'} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                <GithubSection />
              </Paper>
            </Grid>
          </Grid>

          {/* Attestation Form */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <AttestForm />
          </Paper>

          {/* Flow Instructions */}
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              How it Works (Web UI)
            </Typography>
            <Box component="ol" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <Typography component="li" variant="body2">
                Connect your wallet using Web3Auth (Google, GitHub, or email)
              </Typography>
              <Typography component="li" variant="body2">
                Connect your GitHub account for identity verification
              </Typography>
              <Typography component="li" variant="body2">
                Fund your smart wallet to cover gas fees (~$0.01)
              </Typography>
              <Typography component="li" variant="body2">
                Sign your GitHub username with your wallet
              </Typography>
              <Typography component="li" variant="body2">
                Create a proof Gist and submit the attestation
              </Typography>
            </Box>
          </Paper>
        </AccordionDetails>
      </Accordion>

      {/* About Section */}
      <Paper elevation={1} sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          What is didgit.dev?
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          didgit.dev creates <strong>on-chain proof</strong> linking your GitHub username to your wallet address. 
          This verified identity can be used for:
        </Typography>
        <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
          <Typography component="li" variant="body2">
            🏆 Building portable developer reputation
          </Typography>
          <Typography component="li" variant="body2">
            💰 Receiving bounties and payments to a verified address
          </Typography>
          <Typography component="li" variant="body2">
            🔐 Accessing gated services that verify identity
          </Typography>
          <Typography component="li" variant="body2">
            🤖 Agent identity — prove your agent controls both accounts
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Powered by <a href="https://attest.sh" target="_blank" rel="noopener noreferrer">EAS</a> on Base. 
          Built by <a href="https://cyberstorm.dev" target="_blank" rel="noopener noreferrer">cyberstorm.dev</a>.
        </Typography>
      </Paper>
    </Container>
  );
};
