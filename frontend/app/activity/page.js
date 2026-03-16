'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ExternalLink, Activity as ActivityIcon, Hash, FileSignature, ShieldCheck, Wallet } from 'lucide-react';

import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent } from '../../components/Card';
import { useAPI } from '../../hooks/useAPI';

function shortHash(h) {
  if (!h) return '-';
  const s = String(h);
  return s.length > 14 ? `${s.slice(0, 10)}…${s.slice(-4)}` : s;
}

function getExplorerTxUrl(chainId, txHash) {
  if (!txHash) return null;
  // Common defaults; if unknown, don't link.
  if (chainId === 1) return `https://etherscan.io/tx/${txHash}`;
  if (chainId === 137) return `https://polygonscan.com/tx/${txHash}`;
  if (chainId === 80002) return `https://amoy.polygonscan.com/tx/${txHash}`;
  if (chainId === 80001) return `https://mumbai.polygonscan.com/tx/${txHash}`;
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chainId === 17000) return `https://holesky.etherscan.io/tx/${txHash}`;
  return null;
}

export default function ActivityPage() {
  const api = useAPI();
  const router = useRouter();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();

  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    if (!isConnected) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/api/activity/${address}`);
        if (mounted) setFeed(resp.activities || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isConnected, address, chainId]);

  const rows = useMemo(() => {
    return (feed || []).map((a, idx) => {
      const txUrl = getExplorerTxUrl(chainId, a.txHash);
      const when = a.timestamp ? new Date(a.timestamp).toLocaleString() : '-';

      let icon = ActivityIcon;
      if (a.type === 'KYC_MINT') icon = ShieldCheck;
      if (a.type === 'TX_TOKENIZE') icon = Wallet;
      if (a.type === 'ENVELOPE_ANCHORED' || a.type === 'ENVELOPE_SIGNED') icon = FileSignature;

      return { ...a, idx, txUrl, when, icon };
    });
  }, [feed, chainId]);

  if (!isConnected) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-20">
          <Card>
            <CardHeader title="Connect your wallet" icon={<Wallet className="w-6 h-6" />} />
            <CardContent>
              <p className="text-gray-300">
                You’re logged in. Connect a wallet to view your on-chain activity and signing proofs.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">Activity</h1>
          <p className="text-gray-400">All your blockchain-related actions in one place (tx hashes + signing proofs).</p>
        </div>

        <Card>
          <CardHeader title="Account Activity" subtitle={address ? `Wallet: ${address.slice(0, 6)}…${address.slice(-4)}` : ''} />
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-gray-400">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-gray-400">No activities found yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-white/10">
                      <th className="py-3 pr-3">Type</th>
                      <th className="py-3 pr-3">Reference</th>
                      <th className="py-3 pr-3">Tx Hash</th>
                      <th className="py-3 pr-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const Icon = r.icon;
                      return (
                        <tr key={r.idx} className="border-b border-white/5">
                          <td className="py-3 pr-3">
                            <div className="inline-flex items-center gap-2">
                              <Icon className="w-4 h-4 text-primary-400" />
                              <span className="text-gray-200">{r.type}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-gray-200">
                            {r.envelopeId ? (
                              <span className="font-mono">{shortHash(r.envelopeId)}</span>
                            ) : r.tokenId ? (
                              <span className="font-mono">#{r.tokenId}</span>
                            ) : r.payloadHash ? (
                              <span className="font-mono">{shortHash(r.payloadHash)}</span>
                            ) : r.typedDataHash ? (
                              <span className="font-mono">{shortHash(r.typedDataHash)}</span>
                            ) : (
                              '-'
                            )}
                            {r.identityTokenId && (
                              <div className="text-xs text-gray-500">DID: <span className="font-mono text-gray-300">{r.identityTokenId}</span></div>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            {r.txHash ? (
                              <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-gray-500" />
                                <span className="font-mono text-gray-200">{shortHash(r.txHash)}</span>
                                {r.txUrl && (
                                  <a href={r.txUrl} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white inline-flex items-center gap-1">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-gray-400">{r.when}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
