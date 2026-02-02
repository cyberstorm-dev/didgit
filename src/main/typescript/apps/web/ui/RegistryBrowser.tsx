import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Skeleton,
  Link,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { OpenInNew, ContentCopy, GitHub } from '@mui/icons-material';
import { appConfig } from '../utils/config';

type Identity = {
  id: string;
  username: string;
  wallet: string;
  attestedAt: string;
  txHash: string;
};

type RegistryState = {
  identities: Identity[];
  total: number;
  loading: boolean;
  error: string | null;
};

function getEasGraphqlEndpoint(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'https://base.easscan.org/graphql';
    case 84532:
      return 'https://base-sepolia.easscan.org/graphql';
    default:
      return 'https://base-sepolia.easscan.org/graphql';
  }
}

function getEasScanUrl(chainId: number): string {
  switch (chainId) {
    case 8453:
      return 'https://base.easscan.org';
    case 84532:
      return 'https://base-sepolia.easscan.org';
    default:
      return 'https://base-sepolia.easscan.org';
  }
}

const IDENTITY_SCHEMA_UID = '0x6ba0509abc1a1ed41df2cce6cbc7350ea21922dae7fcbc408b54150a40be66af';

async function fetchIdentities(
  chainId: number,
  skip: number,
  take: number
): Promise<{ identities: Identity[]; total: number }> {
  const endpoint = getEasGraphqlEndpoint(chainId);

  // Query for attestations
  const query = `
    query GetIdentities($schemaId: String!, $skip: Int!, $take: Int!) {
      attestations(
        where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
        orderBy: { time: desc }
        skip: $skip
        take: $take
      ) {
        id
        recipient
        attester
        time
        txid
        decodedDataJson
      }
      aggregateAttestation(where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }) {
        _count {
          _all
        }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { schemaId: IDENTITY_SCHEMA_UID, skip, take },
    }),
  });

  if (!response.ok) {
    throw new Error(`EAS API error: ${response.status}`);
  }

  const data = await response.json();
  const attestations = data?.data?.attestations ?? [];
  const total = data?.data?.aggregateAttestation?._count?._all ?? 0;

  const identities: Identity[] = attestations.map((att: any) => {
    let username = 'unknown';
    try {
      const decoded = JSON.parse(att.decodedDataJson);
      // Find username field in decoded data
      const usernameField = decoded.find((d: any) => d.name === 'username');
      if (usernameField?.value?.value) {
        username = usernameField.value.value;
      }
    } catch {}

    return {
      id: att.id,
      username,
      wallet: att.recipient,
      attestedAt: new Date(att.time * 1000).toISOString(),
      txHash: att.txid,
    };
  });

  return { identities, total };
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const RegistryBrowser: React.FC = () => {
  const [state, setState] = useState<RegistryState>({
    identities: [],
    total: 0,
    loading: true,
    error: null,
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const config = appConfig();
  const easScanUrl = getEasScanUrl(config.CHAIN_ID);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchIdentities(config.CHAIN_ID, page * rowsPerPage, rowsPerPage)
      .then(({ identities, total }) => {
        setState({ identities, total, loading: false, error: null });
      })
      .catch((err) => {
        console.error('Failed to fetch identities:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        }));
      });
  }, [config.CHAIN_ID, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          📋 Identity Registry
        </Typography>
        <Chip
          label={`${state.total} verified`}
          size="small"
          color="success"
          variant="outlined"
        />
      </Box>

      {state.error && (
        <Typography color="error" sx={{ mb: 2 }}>
          Failed to load registry: {state.error}
        </Typography>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>GitHub</TableCell>
              <TableCell>Wallet</TableCell>
              <TableCell>Attested</TableCell>
              <TableCell align="right">Links</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.loading ? (
              // Loading skeletons
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton width={100} /></TableCell>
                  <TableCell><Skeleton width={120} /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={60} /></TableCell>
                </TableRow>
              ))
            ) : state.identities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No identities found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              state.identities.map((identity) => (
                <TableRow key={identity.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GitHub sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Link
                        href={`https://github.com/${identity.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ textDecoration: 'none' }}
                      >
                        {identity.username}
                      </Link>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {truncateAddress(identity.wallet)}
                      </Typography>
                      <Tooltip title={copiedId === identity.id ? 'Copied!' : 'Copy address'}>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(identity.wallet, identity.id)}
                        >
                          <ContentCopy sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(identity.attestedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View on EAS">
                      <IconButton
                        size="small"
                        href={`${easScanUrl}/attestation/view/${identity.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <OpenInNew sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={state.total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
  );
};
