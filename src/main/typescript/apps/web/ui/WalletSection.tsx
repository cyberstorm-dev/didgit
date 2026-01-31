import React from 'react';
import { useWallet } from '../wallet/WalletContext';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/alert';
 

export const WalletSection: React.FC = () => {
  const { address, smartAddress, connect, disconnect, connected, isContract, balanceWei, openWallet, provisioning, busyOpen, wallets, privyUser, lastError, refreshOnchain, ensureAa, diag, testEp } = useWallet();
  const [showDebug, setShowDebug] = React.useState(false);

  return (
    <section>
      <h3 className="text-lg font-semibold mb-2">Wallet</h3>
      {/* Readiness summary */}
      <div className="text-xs text-gray-700 mb-2 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span>Readiness:</span>
          <span>Address: {smartAddress ? '✔' : '✖'}</span>
          <span>Gas: {balanceWei !== null && balanceWei > 0n ? '✔' : '✖'}</span>
          <span>Client: {connected && smartAddress ? '✔' : '✖'}</span>
          {/* Initialized removed in EP 0.6 sudo-only flow */}
          <button className="underline" onClick={() => { void ensureAa(); void refreshOnchain(); }}>
            Check again
          </button>
        </div>
      </div>

      {!connected ? (
        <div className="flex flex-col gap-2">
          <Button onClick={connect} disabled={provisioning}>{provisioning ? 'Provisioning…' : 'Create Smart Wallet'}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm">Signer (EOA): <code>{address}</code></div>
          <div className="text-sm">Smart Wallet (AA): <code>{smartAddress ?? '—'}</code></div>
          <div className="text-xs text-gray-600">AA writes do not require switching networks.</div>
          {!smartAddress && connected && (
            <Alert className="mt-2">
              {provisioning ? 'Provisioning your 4337 smart wallet…' : 'Smart wallet not initialized yet.'}
              <div className="mt-2"><Button variant="outline" onClick={openWallet} disabled={busyOpen}>Open Wallet</Button></div>
              {lastError && <div className="mt-2 text-xs text-red-700">{lastError}</div>}
            </Alert>
          )}
          {/* No separate initialize step in EP 0.6 flow */}
          {!isContract && smartAddress === address && smartAddress && (
            <div className="mt-2 text-xs text-gray-600">
              Smart wallet is operating in EIP-7702 mode (uses your EOA address).
            </div>
          )}
          {!isContract && smartAddress && smartAddress !== address && (
            <Alert className="mt-2">
              {provisioning ? 'Provisioning your 4337 smart wallet…' : 'Creating your 4337 smart wallet…'} After SSO, click “Open Wallet” to finalize provisioning if the AA address stays empty.
              <div className="mt-2"><Button variant="outline" onClick={openWallet} disabled={provisioning}>Open Wallet</Button></div>
              {lastError && <div className="mt-2 text-xs text-red-700">{lastError}</div>}
            </Alert>
          )}
          {smartAddress && balanceWei !== null && balanceWei === 0n && (
            <Alert className="mt-2">
              Your AA wallet has 0 ETH on Base Sepolia. Please fund it to cover gas.
              <div className="mt-1 flex gap-2">
                <a className="text-blue-600 underline" href="https://www.coinbase.com/faucets/base-sepolia-faucet" target="_blank" rel="noreferrer">Open faucet</a>
                <button className="text-blue-600 underline" onClick={() => navigator.clipboard.writeText(smartAddress ?? '')}>Copy address</button>
              </div>
            </Alert>
          )}
          {/* Removed extra wallet manager button to avoid external wallet confusion */}
          <div className="pt-1">
            <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
          </div>
        </div>
      )}
      <details className="mt-2" open={showDebug} onToggle={(e) => setShowDebug((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-xs text-gray-500">Debug: Wallet objects</summary>
        <pre className="text-[10px] bg-gray-50 p-2 rounded border overflow-auto max-h-40">{JSON.stringify({
          wallets: wallets?.map((w: any) => ({ type: w?.type, walletClientType: w?.walletClientType, address: w?.address, capabilities: w?.capabilities })),
          privyUserSmart: privyUser?.smartWallet?.address || privyUser?.embeddedWallet?.smartWallet?.address || privyUser?.wallet?.smartWallet?.address || null,
        }, null, 2)}</pre>
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" onClick={() => testEp('0.6')}>Test EP 0.6</Button>
          <Button variant="outline" onClick={() => testEp('0.7')}>Test EP 0.7</Button>
          {diag && <span className="text-[10px] text-gray-700">{diag}</span>}
        </div>
      </details>
    </section>
  );
};
