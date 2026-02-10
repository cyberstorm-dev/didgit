export function getAttesterPrivKey(): string {
  const key = (process.env.ATTESTER_PRIVKEY || process.env.VERIFIER_PRIVKEY || '').trim();
  if (!key) {
    throw new Error('ATTESTER_PRIVKEY required (or legacy VERIFIER_PRIVKEY)');
  }
  return key;
}
