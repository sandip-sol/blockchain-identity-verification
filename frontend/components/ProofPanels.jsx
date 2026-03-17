'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    CheckCircle2,
    Clock3,
    Copy,
    ExternalLink,
    FileCheck2,
    Fingerprint,
    QrCode,
    ShieldCheck,
    CalendarClock,
    Hash,
    Wallet,
} from 'lucide-react';

function truncateMiddle(value, start = 14, end = 8) {
    if (!value) return '-';
    const stringValue = String(value);
    if (stringValue.length <= start + end + 3) return stringValue;
    return `${stringValue.slice(0, start)}...${stringValue.slice(-end)}`;
}

function statusTone(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('verified')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (normalized.includes('pending')) return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
    if (normalized.includes('signed')) return 'bg-sky-500/15 text-sky-200 border-sky-500/30';
    return 'bg-white/10 text-gray-200 border-white/15';
}

export function CopyableValue({ label, value, truncate = false, monospace = false }) {
    const [copied, setCopied] = useState(false);
    const displayValue = value ? (truncate ? truncateMiddle(value) : String(value)) : '-';

    const onCopy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(String(value));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3.5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
            <div className="mt-2 flex items-start justify-between gap-3">
                <p
                    title={value ? String(value) : ''}
                    className={`text-sm text-white leading-6 break-all ${monospace ? 'font-mono text-[13px]' : ''}`}
                >
                    {displayValue}
                </p>
                {value ? (
                    <button
                        type="button"
                        onClick={onCopy}
                        title="Copy value"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            {copied ? <p className="mt-2 text-[11px] text-emerald-300">Copied</p> : null}
        </div>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <section className="rounded-2xl border border-white/10 bg-[#0f131b]/90 p-4">
            <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                    <Icon className="h-4 w-4 text-white/80" />
                </div>
                <h4 className="text-sm font-semibold tracking-wide text-white">{title}</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{children}</div>
        </section>
    );
}

export function ProofHero({ title, signer, signerAddress, signedAt, signedStatus, anchorStatus, actions }) {
    return (
        <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_38%),linear-gradient(145deg,rgba(11,16,24,0.98),rgba(18,28,40,0.92))] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-sky-200">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {title}
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">{signer || 'Unknown signer'}</h3>
                    <p className="mt-2 max-w-2xl text-sm text-white/60">
                        Signed by wallet-backed identity proof with final PDF integrity, blockchain anchor state, and verification metadata.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${statusTone(signedStatus)}`}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {signedStatus}
                        </span>
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${statusTone(anchorStatus)}`}>
                            {anchorStatus?.toLowerCase().includes('verified') ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {anchorStatus}
                        </span>
                    </div>
                </div>
                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <CopyableValue label="Signer Wallet" value={signerAddress} truncate monospace />
                <CopyableValue label="Signed At" value={signedAt} />
                <CopyableValue label="Verification State" value={anchorStatus} />
            </div>
        </div>
    );
}

export function ProofDetailsGrid({ summary, auditTrail, verificationUrl, explorerUrl, anchorStatus }) {
    return (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
                <Section title="Signing Details" icon={Fingerprint}>
                    <CopyableValue label="Signer" value={summary?.signerDisplayName || summary?.signer || summary?.signerAddress} />
                    <CopyableValue label="Agreement ID" value={summary?.agreementId} truncate monospace />
                    <CopyableValue label="Signing Timestamp" value={summary?.signedAt || summary?.signedTimestamp} />
                    <CopyableValue label="Final Status" value={auditTrail?.finalStatus || summary?.finalStatus || anchorStatus} />
                </Section>

                <Section title="Document Integrity" icon={FileCheck2}>
                    <CopyableValue label="Canonical Document Hash" value={summary?.documentHash} truncate monospace />
                    <CopyableValue label="Rendered PDF Hash" value={summary?.finalPdfHash} truncate monospace />
                </Section>

                <Section title="Blockchain" icon={Hash}>
                    <CopyableValue label="Network" value={summary?.blockchainNetwork || summary?.network} />
                    <CopyableValue label="Transaction Hash" value={summary?.transactionHash} truncate monospace />
                    <CopyableValue label="Anchor Status" value={anchorStatus} />
                    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3.5">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Explorer</p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-sm text-white/75">Open blockchain transaction details</p>
                            {explorerUrl ? (
                                <Link href={explorerUrl} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white">
                                    Open <ExternalLink className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className="text-sm text-white/35">Unavailable</span>
                            )}
                        </div>
                    </div>
                </Section>
            </div>

            <div className="space-y-4">
                <Section title="Timeline" icon={CalendarClock}>
                    <CopyableValue label="Created" value={auditTrail?.documentCreatedAt} />
                    <CopyableValue label="Sent" value={auditTrail?.documentSentAt} />
                    <CopyableValue label="Viewed" value={auditTrail?.signerViewedAt} />
                    <CopyableValue label="Signed" value={auditTrail?.signerSignedAt || summary?.signedAt || summary?.signedTimestamp} />
                </Section>

                <Section title="Identity" icon={Wallet}>
                    <CopyableValue label="Signer Wallet" value={auditTrail?.signerWalletAddress || summary?.signerAddress} truncate monospace />
                    <CopyableValue label="IP Address" value={auditTrail?.ipAddress} />
                    <CopyableValue label="Agreement Reference" value={auditTrail?.agreementId || summary?.agreementId} truncate monospace />
                    <CopyableValue label="Identity Status" value={auditTrail?.finalStatus || anchorStatus} />
                </Section>

                <Section title="Verification" icon={QrCode}>
                    <CopyableValue label="Verification URL" value={verificationUrl} truncate />
                    <CopyableValue label="QR Destination" value={verificationUrl} truncate />
                </Section>
            </div>
        </div>
    );
}

export function CompactAuditTrail({ auditTrail }) {
    const items = [
        ['Created', auditTrail?.documentCreatedAt],
        ['Sent', auditTrail?.documentSentAt],
        ['Viewed', auditTrail?.signerViewedAt],
        ['Signed', auditTrail?.signerSignedAt],
        ['Wallet', auditTrail?.signerWalletAddress],
        ['IP', auditTrail?.ipAddress],
        ['Document Hash', auditTrail?.documentHash],
        ['Transaction', auditTrail?.transactionHash],
        ['Chain', auditTrail?.chain],
        ['Agreement', auditTrail?.agreementId],
        ['Status', auditTrail?.finalStatus],
    ];

    return (
        <div className="rounded-2xl border border-white/10 bg-[#0d1118] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold text-white">Audit Trail</h4>
                    <p className="text-xs text-white/50">Compact event summary for quick review</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60">
                    Timeline
                </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{label}</p>
                        <p title={value ? String(value) : ''} className="mt-1 text-sm text-white break-all">
                            {value ? String(value) : 'Not recorded'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function VerificationChecksCard({ checks }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#0d1118] p-4">
            <div className="mb-4">
                <h4 className="text-sm font-semibold text-white">Verification</h4>
                <p className="text-xs text-white/50">Integrity and anchor checks</p>
            </div>
            <div className="space-y-2.5">
                {checks.map(([label, passed]) => (
                    <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                        <p className="text-sm text-white/85">{label}</p>
                        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${passed === true ? statusTone('verified') : passed === false ? 'bg-red-500/15 text-red-200 border-red-500/30' : statusTone('pending')}`}>
                            {passed === true ? 'Pass' : passed === false ? 'Fail' : 'Pending'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
