'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import {
    ExternalLink,
    FileText,
    Users,
    CheckCircle2,
    Clock,
    ArrowLeft,
    ArrowRight,
    ShieldCheck,
    AlertTriangle,
    Download,
    Stamp,
    Search,
} from 'lucide-react';

import Navbar from '../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../components/Card';
import StatusBadge from '../../../components/StatusBadge';
import { useAPI } from '../../../hooks/useAPI';
import { formatTimestamp } from '../../../utils/proof';

function statusBadge(status) {
    const s = String(status || '').toUpperCase();
    const map = {
        DRAFT: { icon: Clock, label: 'Draft', cls: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
        SENT: { icon: Clock, label: 'Sent', cls: 'bg-primary-500/20 text-primary-300 border-primary-500/40' },
        IN_PROGRESS: { icon: Clock, label: 'In Progress', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
        COMPLETED: { icon: CheckCircle2, label: 'Completed', cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
        VOID: { icon: AlertTriangle, label: 'Voided', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
    };
    return map[s] || map.DRAFT;
}

function shortHash(h) {
    if (!h) return '-';
    const s = String(h);
    return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
}

function recipientActionLabel(recipient) {
    switch (recipient?.signingState) {
        case 'READY_TO_SIGN':
            return 'Ready to sign';
        case 'WAITING_FOR_PREVIOUS_SIGNER':
            return 'Waiting for previous signer';
        case 'SIGNED':
            return 'Signed';
        case 'EXPIRED':
            return 'Expired';
        case 'VOIDED':
            return 'Voided';
        default:
            return recipient?.status || 'Pending';
    }
}

export default function EnvelopeDetailsPage() {
    const api = useAPI();
    const params = useParams();
    const envelopeId = params?.envelopeId;

    const [data, setData] = useState(null);
    const [verifyData, setVerifyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [docLoading, setDocLoading] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [voiding, setVoiding] = useState(false);
    const [showTechnical, setShowTechnical] = useState(false);

    const loadEnvelope = async () => {
        if (!envelopeId) return;
        const resp = await api.get(`/api/envelopes/${envelopeId}`);
        setData(resp);
        try {
            const verifyResp = await api.get(`/api/envelopes/${envelopeId}/verify`);
            setVerifyData(verifyResp);
        } catch (_) {
            setVerifyData(null);
        }
    };

    useEffect(() => {
        if (!envelopeId) return;
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const resp = await api.get(`/api/envelopes/${envelopeId}`);
                const verifyResp = await api.get(`/api/envelopes/${envelopeId}/verify`).catch(() => null);
                if (mounted) {
                    setData(resp);
                    setVerifyData(verifyResp);
                }
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

    const openDocument = async (kind) => {
        try {
            setDocLoading(true);
            const response = await api.client.get(`/api/envelopes/${envelopeId}/document/${kind}`, {
                responseType: 'blob',
            });
            const fileUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
            setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60_000);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || `Failed to open ${kind} document`);
        } finally {
            setDocLoading(false);
        }
    };

    const downloadDocument = async () => {
        try {
            setDocLoading(true);
            const response = await api.client.get(`/api/envelopes/${envelopeId}/document/final`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const fileUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = fileUrl;
            anchor.download = `${envelopeId}-signed-proof.pdf`;
            anchor.click();
            setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60_000);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to download signed PDF');
        } finally {
            setDocLoading(false);
        }
    };

    const onVoid = async () => {
        if (!voidReason.trim()) {
            toast.error('Add a reason before voiding the envelope');
            return;
        }
        try {
            setVoiding(true);
            await api.post(`/api/envelopes/${envelopeId}/void`, { reason: voidReason.trim() });
            toast.success('Envelope voided');
            await loadEnvelope();
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to void envelope');
        } finally {
            setVoiding(false);
        }
    };

    const env = data?.envelope;
    const recipients = data?.recipients || [];
    const auditLogs = data?.auditLogs || [];
    const access = data?.access || { isOwner: false, isRecipient: false };
    const proof = data?.proof || {};
    const proofSummary = proof?.summary || {};
    const auditTrail = proof?.auditTrail || {};
    const badge = statusBadge(env?.status);
    const BadgeIcon = badge.icon;

    const progress = useMemo(() => {
        const total = recipients.filter((r) => r.role === 'SIGNER').length;
        const signed = recipients.filter((r) => r.role === 'SIGNER' && r.status === 'SIGNED').length;
        return { total, signed };
    }, [recipients]);

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h1 className="text-3xl font-bold text-gradient">Envelope</h1>
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${badge.cls}`}>
                                <BadgeIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">{badge.label}</span>
                            </div>
                            {access.isOwner && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-gray-300">
                                    Owner view
                                </div>
                            )}
                        </div>
                        <p className="text-gray-400 break-all">ID: {envelopeId}</p>
                        {env?.metadata?.title && <p className="text-white mt-2 text-lg font-semibold">{env.metadata.title}</p>}
                        {env?.metadata?.description && <p className="text-gray-400 mt-1">{env.metadata.description}</p>}
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
                            <CardHeader title="Status" subtitle="Operational summary for owner and signers" />
                            <CardContent>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400 text-sm">Next action</p>
                                        <p className="text-white font-medium mt-1">{env.nextAction}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400 text-sm">Signer progress</p>
                                        <p className="text-white font-medium mt-1">{progress.signed} / {progress.total} signed</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400 text-sm">Anchor status</p>
                                        <p className="text-white font-medium mt-1">{verifyData?.anchor?.status || (proof?.anchor?.txHash ? 'Anchored' : 'Pending')}</p>
                                    </div>
                                </div>
                                {env.voidReason && (
                                    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                                        Void reason: {env.voidReason}
                                    </div>
                                )}
                                {env.expiresAt && (
                                    <p className="text-sm text-gray-400 mt-4">Expires: {new Date(env.expiresAt).toLocaleString()}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Documents" subtitle="Authenticated document access only" />
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {data?.documents?.original && (
                                        <button
                                            type="button"
                                            onClick={() => openDocument('original')}
                                            disabled={docLoading}
                                            className="primary-button inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FileText className="w-5 h-5" /> Open Source Document
                                        </button>
                                    )}
                                    {data?.documents?.final && (
                                        <button
                                            type="button"
                                            onClick={() => openDocument('final')}
                                            disabled={docLoading}
                                            className="secondary-button inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <ExternalLink className="w-5 h-5" /> Open Rendered PDF
                                        </button>
                                    )}
                                    {data?.documents?.final && (
                                        <button
                                            type="button"
                                            onClick={downloadDocument}
                                            disabled={docLoading}
                                            className="secondary-button inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Download className="w-5 h-5" /> Download Signed PDF
                                        </button>
                                    )}
                                    {proof?.verificationUrl && (
                                        <Link
                                            href={`/verify?envelopeId=${encodeURIComponent(envelopeId)}`}
                                            className="secondary-button inline-flex items-center gap-2"
                                        >
                                            <Search className="w-5 h-5" /> Verify Document
                                        </Link>
                                    )}
                                </div>
                                <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Canonical signed source hash</p>
                                        <p className="break-all text-gray-200 mt-1">{proof?.canonical?.signedSourceHash || '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Rendered final hash</p>
                                        <p className="break-all text-gray-200 mt-1">{proof?.rendered?.finalHash || '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Verification</p>
                                        <p className="text-gray-200 mt-1">
                                            {verifyData?.canonical?.anchoredSourceHashMatches === true
                                                ? 'Canonical source proof matches anchor'
                                                : verifyData?.canonical?.anchoredSourceHashMatches === false
                                                    ? 'Anchor mismatch detected'
                                                    : 'Verification pending'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {(proofSummary?.agreementId || auditTrail?.agreementId) && (
                            <Card>
                                <CardHeader title="Proof of Signature" subtitle="Visible trust metadata generated for the final signed PDF" />
                                <CardContent>
                                    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-blue-500/10 p-5">
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div>
                                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
                                                    <Stamp className="w-4 h-4" />
                                                    {proofSummary?.label || 'Digitally Signed'}
                                                </div>
                                                <p className="mt-3 text-xl font-semibold text-white">{proofSummary?.signerDisplayName || '-'}</p>
                                                <p className="text-sm text-gray-400">{proofSummary?.verificationStatusText || 'Verification metadata available'}</p>
                                            </div>
                                            <StatusBadge status={env.status === 'COMPLETED' ? 'finalized' : 'signed'} />
                                        </div>

                                        <div className="mt-5 grid md:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                                <p className="text-gray-400">Signed at</p>
                                                <p className="mt-1 text-white">{formatTimestamp(proofSummary?.signedAt)}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                                <p className="text-gray-400">Blockchain network</p>
                                                <p className="mt-1 text-white">{proofSummary?.blockchainNetwork || '-'}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                                <p className="text-gray-400">Document hash</p>
                                                <p className="mt-1 text-white break-all">{proofSummary?.documentHash || '-'}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                                <p className="text-gray-400">Transaction hash</p>
                                                <p className="mt-1 text-white break-all">{proofSummary?.transactionHash || 'Pending blockchain anchor'}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-3">
                                            <Link
                                                href={`/verify?envelopeId=${encodeURIComponent(envelopeId)}`}
                                                className="primary-button inline-flex items-center gap-2"
                                            >
                                                <ShieldCheck className="w-5 h-5" /> View Proof
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4 text-sm mt-4">
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Agreement ID</p>
                                            <p className="text-white mt-1 break-all">{proofSummary?.agreementId || '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Verification URL</p>
                                            <p className="text-white mt-1 break-all">{proof?.verificationUrl || '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Audit final status</p>
                                            <p className="text-white mt-1">{auditTrail?.finalStatus || '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Signer wallet</p>
                                            <p className="text-white mt-1 break-all">{auditTrail?.signerWalletAddress || '-'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader title="Recipients" subtitle="Progress and state-aware signing actions" />
                            <CardContent>
                                {recipients.length === 0 ? (
                                    <p className="text-gray-400">No recipients added yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {recipients.map((r) => (
                                            <div key={r.recipientAddress} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-gray-400" />
                                                            <p className="font-medium text-gray-200 break-all">{r.recipientAddress}</p>
                                                        </div>
                                                        <p className="text-sm text-gray-400 mt-1">
                                                            Status: <span className="text-gray-200">{recipientActionLabel(r)}</span> · Order: {r.signingOrder}
                                                        </p>
                                                        {(r.identityTokenId || r.signedAt) && (
                                                            <div className="mt-2 text-xs text-gray-400 space-y-1">
                                                                {r.identityTokenId && <p>DID at signing: <span className="text-gray-200 font-mono">{r.identityTokenId}</span></p>}
                                                                {r.signedAt && <p>Signed at: <span className="text-gray-200">{new Date(r.signedAt).toLocaleString()}</span></p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Link
                                                            href={`/envelopes/${envelopeId}/sign?recipient=${r.recipientAddress}`}
                                                            className="secondary-button inline-flex items-center gap-2"
                                                        >
                                                            {r.canSignNow ? 'Review / Sign' : 'View'}
                                                            <ArrowRight className="w-4 h-4" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {access.isOwner && env.status !== 'VOID' && env.status !== 'COMPLETED' && (
                            <Card>
                                <CardHeader title="Owner Controls" subtitle="Use sparingly once the envelope has been sent" />
                                <CardContent>
                                    <div className="space-y-3">
                                        <textarea
                                            value={voidReason}
                                            onChange={(e) => setVoidReason(e.target.value)}
                                            placeholder="Reason for voiding this envelope"
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={onVoid}
                                            disabled={voiding}
                                            className="secondary-button inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <AlertTriangle className="w-4 h-4" /> Void Envelope
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader title="Proof Summary" subtitle="Human-readable proof state first, technical details second" />
                            <CardContent>
                                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center gap-2 text-gray-200">
                                        <ShieldCheck className="w-4 h-4" />
                                        <p>
                                            Wallet signatures approve the canonical source document hash. The rendered PDF is a derived view that may include visual signature stamps.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowTechnical((v) => !v)}
                                    className="text-sm text-gray-300 hover:text-white mt-4"
                                >
                                    {showTechnical ? 'Hide technical proof details' : 'Show technical proof details'}
                                </button>
                                {showTechnical && (
                                    <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Source hash</p>
                                            <p className="break-all text-gray-200 mt-1">{proof?.technical?.sourceDocumentHash || '-'}</p>
                                            <p className="text-gray-400 mt-3">Rendered hash</p>
                                            <p className="break-all text-gray-200 mt-1">{proof?.technical?.renderedDocumentHash || '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                            <p className="text-gray-400">Anchor tx</p>
                                            <p className="break-all text-gray-200 mt-1">{proof?.technical?.anchoredTxHash || '-'}</p>
                                            <p className="text-gray-400 mt-3">Rendered CID</p>
                                            <p className="break-all text-gray-200 mt-1">{shortHash(proof?.technical?.renderedDocumentCID) || '-'}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Audit Log" subtitle="Append-only workflow events" />
                            <CardContent>
                                {auditLogs.length === 0 ? (
                                    <p className="text-gray-400">No events yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {auditLogs.slice().reverse().map((l, idx) => (
                                            <div key={`${l.eventType}-${l.createdAt}-${idx}`} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                                    <p className="text-sm font-medium text-gray-200">{l.eventType}</p>
                                                    <p className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleString()}</p>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1 break-all">Actor: {l.actor || '-'}</p>
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
