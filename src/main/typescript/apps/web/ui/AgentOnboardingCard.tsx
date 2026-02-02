import React from 'react';
import { Paper, Typography, Box, Button, Chip } from '@mui/material';
import { Terminal, GitHub, Speed, Code } from '@mui/icons-material';

export const AgentOnboardingCard: React.FC = () => {
  return (
    <Paper
      elevation={3}
      sx={{
        p: 4,
        mb: 4,
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
        border: '2px solid #00d4aa',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Terminal sx={{ color: '#00d4aa', fontSize: 32 }} />
        <Box>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold' }}>
            Agent Onboarding
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Register via CLI in 5 minutes — no dapp needed
          </Typography>
        </Box>
        <Chip
          label="Recommended"
          size="small"
          sx={{
            ml: 'auto',
            bgcolor: '#00d4aa',
            color: '#000',
            fontWeight: 'bold',
          }}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Benefits */}
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#00d4aa', mb: 1.5, fontWeight: 'bold' }}>
            Why CLI?
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Speed sx={{ color: '#00d4aa', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Faster than the web UI
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Code sx={{ color: '#00d4aa', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Scriptable & automatable
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GitHub sx={{ color: '#00d4aa', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Works with any wallet & GitHub token
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Quick Start */}
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#00d4aa', mb: 1.5, fontWeight: 'bold' }}>
            Quick Start
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 1,
              p: 1.5,
              fontSize: '0.75rem',
              color: '#e6edf3',
              overflow: 'auto',
              fontFamily: 'monospace',
            }}
          >
{`# 1. Sign message with your wallet
cast wallet sign "github.com:username"

# 2. Create proof gist
curl -X POST api.github.com/gists ...

# 3. Submit attestation
# See full guide →`}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          href="https://github.com/cyberstorm-dev/didgit/tree/main/skills/didgit-onboarding"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            bgcolor: '#00d4aa',
            color: '#000',
            fontWeight: 'bold',
            '&:hover': { bgcolor: '#00b894' },
          }}
          startIcon={<Terminal />}
        >
          View Full Skill Guide
        </Button>
        <Button
          variant="outlined"
          href="https://github.com/cyberstorm-dev/didgit/blob/main/docs/AGENT_ONBOARDING.md"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            borderColor: 'rgba(255,255,255,0.3)',
            color: 'rgba(255,255,255,0.9)',
            '&:hover': { borderColor: '#00d4aa', color: '#00d4aa' },
          }}
        >
          Human Guide
        </Button>
      </Box>
    </Paper>
  );
};
