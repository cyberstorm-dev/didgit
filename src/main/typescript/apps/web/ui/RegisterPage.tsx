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
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { AAWalletStatus } from './AAWalletStatus';
import { useWallet } from '../wallet/WalletContext';
import { GithubSection } from './GithubSection';
import { AttestForm } from './AttestForm';
import { VerifyPanel } from './VerifyPanel';

export const RegisterPage: React.FC = () => {
  const { connected } = useWallet();


  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Wallet and GitHub Connection */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
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
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <AttestForm />
      </Paper>

      {/* Flow Instructions */}
      <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          How it Works
        </Typography>
        <Box component="ol" sx={{ pl: 2, '& li': { mb: 1 } }}>
          <Typography component="li" variant="body2">
            Connect your wallet using the button in the top-right corner
          </Typography>
          <Typography component="li" variant="body2">
            Connect your GitHub account for identity verification
          </Typography>
          <Typography component="li" variant="body2">
            Fund your smart wallet to cover gas fees
          </Typography>
          <Typography component="li" variant="body2">
            Sign your GitHub username with your wallet to create the binding
          </Typography>
          <Typography component="li" variant="body2">
            Create a proof Gist and submit the attestation to EAS
          </Typography>
          <Typography component="li" variant="body2">
            All repositories are enabled by default - customize patterns in Settings
          </Typography>
        </Box>
      </Paper>

      {/* Verification Panel */}
      <Accordion elevation={1}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1">
            Verification & Search
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <VerifyPanel />
        </AccordionDetails>
      </Accordion>
    </Container>
  );
};