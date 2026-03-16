'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { ExternalLink, FileText, Users, CheckCircle2, Clock, ArrowLeft, ArrowRight } from 'lucide-react';

import Navbar from '../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../components/Card';
import { useAPI } from '../../../hooks/useAPI';

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';

function statusBadge(status) {
    const s = String(status || '').toUpperCase();
    const map = {
        DRAFT: { icon: Clock, label: 'Draft', cls: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
        SENT: { icon: Clock, label: 'Sent', cls: 'bg-primary-500/20 text-primary-300 border-primary-500/40' },
        IN_PROGRESS: { icon: Clock, label: 'In Progress', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
        COMPLETED: { icon: CheckCircle2, label: 'Completed', cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
        VOID: { icon: Clock, label: 'Void', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
    };
    return map[s] || map.DRAFT;
}

function shortHash(h) {
    if (!h) return '-';
    const s = String(h);
    return s.length > 14 ? `${s.slice(0, 10)}…${s.slice(-4)}` : s;
}

export default function EnvelopeDetailsPage() {
    const api = useAPI();
    const params = useParams();
    const envelopeId = params?.envelopeId;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!envelopeId) return;
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const resp = await api.get(`/api/envelopes/${envelopeId}`);
                if (mounted) setData(resp);
            } catch (e) {
                toast.error(e?.response?.data?.error || e.message || 'Failed to load envelope');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [envelopeId]);

    const env = data?.envelope;
    const recipients = data?.recipients || [];
    const auditLogs = data?.auditLogs || [];

    const docUrl = useMemo(() => {
        const cid = env?.documentFinalCID || env?.documentOriginalCID;
        return cid ? `${IPFS_GATEWAY}${cid}` : null;
    }, [env?.documentFinalCID, env?.documentOriginalCID]);

    const badge = statusBadge(env?.status);
    const BadgeIcon = badge.icon;

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-gradient">Envelope</h1>
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${badge.cls}`}>
                                <BadgeIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">{badge.label}</span>
                            </div>
                        </div>
                        <p className="text-gray-400 break-all">ID: {envelopeId}</p>
                    </div>
                    <Link href="/envelopes" className="text-gray-300 hover:text-white inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Link>
                </div>

                {loading ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">Loading…</CardContent>
                    </Card>
                ) : !env ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">Envelope not found.</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader title="Document" subtitle="Original and latest signed version stored on IPFS" />
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Original CID</p>
                                            <p className="break-all text-gray-200">{env.documentOriginalCID || '-'}</p>
                                            <p className="text-gray-400 mt-2">Original Hash</p>
                                            <p className="break-all text-gray-200">{env.documentOriginalHash || '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Final CID</p>
                                            <p className="break-all text-gray-200">{env.documentFinalCID || '-'}</p>
                                            <p className="text-gray-400 mt-2">Final Hash</p>
                                            <p className="break-all text-gray-200">{env.documentFinalHash || '-'}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                                        <p className="text-gray-400">Blockchain Proof (Anchor Tx)</p>
                                        <p className="break-all text-gray-200">
                                            {env.anchoredTxHash ? env.anchoredTxHash : 'Not anchored yet'}
                                        </p>
                                        {env.anchoredAt && (
                                            <p className="text-xs text-gray-400 mt-1">Anchored at: {new Date(env.anchoredAt).toLocaleString()}</p>
                                        )}
                                    </div>

                                    {docUrl && (
                                        <a
                                            href={docUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="primary-button inline-flex items-center gap-2"
                                        >
                                            <FileText className="w-5 h-5" /> Open Document <ExternalLink className="w-5 h-5" />
                                        </a>
                                    )}

                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Recipients" subtitle="Share the signing link with each recipient" />
                            <CardContent>
                                {recipients.length === 0 ? (
                                    <p className="text-gray-400">No recipients added yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {recipients.map((r) => (
                                            <div key={r._id || r.recipientAddress} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-gray-400" />
                                                            <p className="font-medium text-gray-200 break-all">{r.recipientAddress}</p>
                                                        </div>
                                                        <p className="text-sm text-gray-400 mt-1">Status: <span className="text-gray-200">{r.status}</span> · Order: {r.signingOrder}</p>
                                                        {(r.identityTokenId || r.typedDataHash || r.signedAt) && (
                                                            <div className="mt-2 text-xs text-gray-400 space-y-1">
                                                                {r.identityTokenId && (
                                                                    <p>
                                                                        Digital ID (DID): <span className="text-gray-200 font-mono">{r.identityTokenId}</span>
                                                                    </p>
                                                                )}
                                                                {r.signedAt && (
                                                                    <p>
                                                                        Signed at: <span className="text-gray-200">{new Date(r.signedAt).toLocaleString()}</span>
                                                                    </p>
                                                                )}
                                                                {r.typedDataHash && (
                                                                    <p>
                                                                        Signature hash: <span className="text-gray-200 font-mono">{shortHash(r.typedDataHash)}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Link
                                                            href={`/envelopes/${envelopeId}/sign?recipient=${r.recipientAddress}`}
                                                            className="secondary-button inline-flex items-center gap-2"
                                                        >
                                                            Sign / View
                                                            <ArrowRight className="w-4 h-4" />
                                                        </Link>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <p className="text-xs text-gray-400">Signing link</p>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-xs break-all text-gray-200">
                                                            {typeof window !== 'undefined'
                                                                ? `${window.location.origin}/envelopes/${envelopeId}/sign?recipient=${r.recipientAddress}`
                                                                : `/envelopes/${envelopeId}/sign?recipient=${r.recipientAddress}`}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const link = `${window.location.origin}/envelopes/${envelopeId}/sign?recipient=${r.recipientAddress}`;
                                                                navigator.clipboard.writeText(link);
                                                                toast.success('Link copied');
                                                            }}
                                                            className="text-xs text-gray-300 hover:text-white"
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Audit Log" subtitle="Append-only activity log" />
                            <CardContent>
                                {auditLogs.length === 0 ? (
                                    <p className="text-gray-400">No events yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {auditLogs.slice().reverse().map((l) => (
                                            <div key={l._id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                                    <p className="text-sm font-medium text-gray-200">{l.eventType}</p>
                                                    <p className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleString()}</p>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1 break-all">Actor: {l.actor}</p>
                                                {l.txHash && <p className="text-xs text-gray-400 mt-1 break-all">Tx: {l.txHash}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
