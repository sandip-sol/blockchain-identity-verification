'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
    Copy,
    Check,
    ExternalLink,
    FileCheck2,
    Fingerprint,
    ShieldCheck,
    CalendarClock,
    Hash,
    Wallet,
    X,
    Eye,
    Link2,
    FileText,
    Send,
    PenLine,
    Lock,
    QrCode,
    BadgeCheck,
} from 'lucide-react';

const tk = {
    sans: "font-['Inter','IBM_Plex_Sans',ui-sans-serif,system-ui,sans-serif]",
    mono: "font-['IBM_Plex_Mono',ui-monospace,monospace]",
    label: 'text-[9px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3] leading-none mb-[4px]',
    value: 'text-[12px] font-semibold text-[#101828] leading-[1.4]',
    sectionHdr: 'flex items-center gap-[6px] mb-[12px]',
    sectionIcon: 'w-3.5 h-3.5 text-[#b0b8c5]',
    sectionLabel: 'text-[8.5px] font-bold uppercase tracking-[0.15em] text-[#98a2b3]',
    cardBorder: 'border border-[#e7ebf1]',
    outerRadius: 'rounded-[24px]',
    innerRadius: 'rounded-[18px]',
};

function truncateMiddle(value, start = 10, end = 6) {
    if (!value) return '–';
    const s = String(value);
    if (s.length <= start + end + 3) return s;
    return `${s.slice(0, start)}…${s.slice(-end)}`;
}

function fmtTime(val) {
    if (!val) return '–';
    try {
        const d = new Date(val);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return String(val);
    }
}

export function CopyableValue({ label, value, truncate = false, monospace = false, className = '' }) {
    const [copied, setCopied] = useState(false);
    const raw = value ? String(value) : '';
    const display = raw ? (truncate ? truncateMiddle(raw) : raw) : '–';

    const copy = async () => {
        if (!raw) return;
        try {
            await navigator.clipboard.writeText(raw);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch { /* silent */ }
    };

    return (
        <div className={`mb-[10px] last:mb-0 ${className}`}>
            <p className={tk.label}>{label}</p>
            <div className="flex min-w-0 items-start gap-1.5">
                <span
                    title={raw || undefined}
                    className={`${tk.value} min-w-0 ${truncate ? 'truncate' : 'break-all'} ${monospace ? `${tk.mono} text-[11px] font-medium text-[#344054]` : ''}`}
                >
                    {display}
                </span>
                {raw && (
                    <button
                        type="button"
                        onClick={copy}
                        className="mt-[1px] shrink-0 rounded p-0.5 text-[#c4cad4] transition-colors hover:text-[#667085]"
                        title={copied ? 'Copied!' : 'Copy'}
                    >
                        {copied
                            ? <Check className="h-[11px] w-[11px] text-emerald-500" />
                            : <Copy className="h-[11px] w-[11px]" />}
                    </button>
                )}
            </div>
        </div>
    );
}

function SectionHdr({ icon: Icon, children }) {
    return (
        <div className={tk.sectionHdr}>
            <Icon className={tk.sectionIcon} />
            <span className={tk.sectionLabel}>{children}</span>
        </div>
    );
}

function SignatureModal({ open, onClose, signatureImageUrl, signer, signerAddress, signedAt }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={ref}
            onClick={(e) => e.target === ref.current && onClose()}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
        >
            <div className="relative w-full max-w-[360px] rounded-[24px] border border-[#e6e9ef] bg-white p-5 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#f8fafc] text-[#98a2b3] transition hover:text-[#475467]"
                >
                    <X className="h-4 w-4" />
                </button>
                <p className={tk.label}>Signature Preview</p>
                <div className="mt-2 flex min-h-[110px] items-center justify-center rounded-[18px] border border-dashed border-[#d9e1eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
                    {signatureImageUrl
                        ? <img src={signatureImageUrl} alt="Signature" className="max-h-[90px] max-w-full object-contain" />
                        : <p className="text-xs italic text-[#c2c8d3]">No signature image available</p>}
                </div>
                <div className="mt-4 space-y-2">
                    {signer && <CopyableValue label="Signer" value={signer} />}
                    {signerAddress && <CopyableValue label="Wallet" value={signerAddress} truncate monospace />}
                    {signedAt && <CopyableValue label="Signed At" value={signedAt} />}
                </div>
            </div>
        </div>
    );
}

function StatusPill({ status }) {
    if (!status) return null;
    const lower = String(status).toLowerCase();
    const isGreen = lower.includes('signed') || lower.includes('verified') || lower.includes('completed');
    const isAmber = lower.includes('pending') || lower.includes('anchor');
    const isRed = lower.includes('failed') || lower.includes('rejected');

    const colors = isGreen
        ? 'border-[#c9ead4] bg-[#edf9f1] text-[#18794e]'
        : isAmber
            ? 'border-[#efd18f] bg-[#fff7e8] text-[#9a6511]'
            : isRed
                ? 'border-[#fecaca] bg-[#fef2f2] text-[#b42318]'
                : 'border-[#e4e7ec] bg-[#f4f5f7] text-[#667085]';

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-[5px] text-[9px] font-bold uppercase tracking-[0.12em] leading-none shadow-[0_1px_1px_rgba(16,24,40,0.03)] ${colors}`}>
            {status}
        </span>
    );
}

function MetaGroup({ title, icon: Icon, children, className = '' }) {
    return (
        <section className={`min-w-0 bg-white/80 p-4 ${className}`}>
            <SectionHdr icon={Icon}>{title}</SectionHdr>
            {children}
        </section>
    );
}

export function ProofHero({
    title,
    signer,
    signerAddress,
    signedAt,
    signedStatus,
    anchorStatus,
    actions,
    signatureImageUrl,
    ipAddress,
    documentHash,
    agreementId,
    transactionHash,
    network,
    verificationUrl,
}) {
    const [sigModal, setSigModal] = useState(false);

    return (
        <>
            <SignatureModal
                open={sigModal}
                onClose={() => setSigModal(false)}
                signatureImageUrl={signatureImageUrl}
                signer={signer}
                signerAddress={signerAddress}
                signedAt={signedAt}
            />

            <div className={`${tk.sans} ${tk.outerRadius} ${tk.cardBorder} overflow-hidden bg-[linear-gradient(180deg,#fffefd_0%,#fbfcfe_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.04)]`}>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf1f5] bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,250,252,0.96))] px-5 py-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e6e9ef] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                                <Lock className="h-4 w-4 text-[#475467]" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">Signature Proof</p>
                                <h3 className="truncate text-[22px] font-semibold tracking-[-0.03em] text-[#101828]">
                                    {title || 'Proof of Signature'}
                                </h3>
                                <p className="mt-1 text-[12px] text-[#667085]">
                                    Machine-readable trust proof for the completed signature event.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-center">
                        <StatusPill status={signedStatus} />
                        <StatusPill status={anchorStatus} />
                        {actions}
                    </div>
                </div>

                <div className="grid gap-px bg-[#edf1f5] p-px sm:grid-cols-2 xl:grid-cols-[170px_minmax(0,1.08fr)_minmax(0,1fr)_188px]">
                    <MetaGroup title="Signature Preview" icon={PenLine}>
                        <div className="rounded-[16px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5">
                            <div className="flex min-h-[86px] items-center justify-center rounded-[14px] border border-dashed border-[#d9e1eb] bg-white px-3 py-3">
                                {signatureImageUrl ? (
                                    <img src={signatureImageUrl} alt="Signature" className="max-h-[54px] max-w-full object-contain" />
                                ) : (
                                    <svg width="58" height="24" viewBox="0 0 48 24" fill="none" className="text-[#cad3de]">
                                        <path d="M4 18 C8 6, 14 6, 16 14 S24 22, 28 12 S36 2, 40 10 S46 16, 44 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-[14px] border border-[#edf1f5] bg-white px-3 py-2.5">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Signed Artifact</p>
                                <p className="text-[11px] font-medium text-[#475467]">Captured signature preview</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSigModal(true)}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d7dee8] bg-[#f8fafc] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#344054] transition hover:bg-white"
                            >
                                <Eye className="h-3 w-3" />
                                View
                            </button>
                        </div>
                    </MetaGroup>

                    <MetaGroup title="Signing Details" icon={Fingerprint} className="border-x border-[#edf1f5]">
                        <CopyableValue label="Signer" value={signer || signerAddress} truncate monospace={!signer} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <CopyableValue label="Signed At" value={signedAt} className="mb-0" />
                            <div className="mb-0 rounded-[14px] border border-[#edf1f5] bg-white px-3 py-2.5">
                                <p className={tk.label}>Status</p>
                                <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#101828]">{signedStatus || 'Pending'}</p>
                            </div>
                        </div>
                        <CopyableValue label="Agreement ID" value={agreementId} truncate monospace className="mt-3 mb-0" />
                    </MetaGroup>

                    <MetaGroup title="Document Integrity" icon={FileCheck2} className="border-t border-[#edf1f5] sm:border-t-0 xl:border-r">
                        <CopyableValue label="Document Hash" value={documentHash} truncate monospace />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <CopyableValue
                                label="IP Address"
                                value={ipAddress}
                                truncate={false}
                                monospace={String(ipAddress || '').includes(':')}
                                className="mb-0"
                            />
                            <div className="mb-0 rounded-[14px] border border-[#edf1f5] bg-white px-3 py-2.5">
                                <p className={tk.label}>Verification</p>
                                <div className="flex items-start gap-2">
                                    <BadgeCheck className="mt-0.5 h-3.5 w-3.5 text-[#12b76a]" />
                                    <p className="text-[13px] font-semibold leading-[1.35] text-[#101828]">
                                        {anchorStatus
                                            ? `${anchorStatus}${signedStatus ? ` • ${signedStatus}` : ''}`
                                            : signedStatus || 'Pending'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </MetaGroup>

                    <MetaGroup title="Blockchain / Verify" icon={Hash} className="border-t border-[#edf1f5] sm:border-t-0">
                        <div className="grid grid-cols-[1fr_88px] gap-3">
                            <div className="min-w-0 space-y-2.5">
                                <CopyableValue label="Transaction" value={transactionHash || anchorStatus} truncate monospace />
                                <CopyableValue label="Network / Chain" value={network} truncate />
                                <CopyableValue label="Signer Wallet" value={signerAddress} truncate monospace className="mb-0" />
                            </div>
                            <div className="flex flex-col items-center rounded-[16px] border border-[#edf1f5] bg-white px-2 py-2.5">
                                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[14px] border border-[#e7ebf1] bg-[#fcfdff]">
                                    {verificationUrl ? (
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&margin=0&data=${encodeURIComponent(verificationUrl)}`}
                                            alt="Verification QR"
                                            className="h-[58px] w-[58px] rounded-[8px]"
                                        />
                                    ) : (
                                        <QrCode className="h-7 w-7 text-[#c4cad4]" />
                                    )}
                                </div>
                                <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-[0.13em] text-[#98a2b3]">Scan to verify</p>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#edf1f5] bg-white px-3 py-2.5">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#98a2b3]">Verification URL</p>
                                <p className="truncate text-[11px] font-medium text-[#475467]" title={verificationUrl || undefined}>
                                    {verificationUrl || 'Verification link unavailable'}
                                </p>
                            </div>
                            {verificationUrl && (
                                <Link
                                    href={verificationUrl}
                                    target="_blank"
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d3dae5] bg-[#f8fafc] px-3 py-1.5 text-[10px] font-semibold text-[#344054] transition hover:bg-white"
                                >
                                    Verify
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            )}
                        </div>
                    </MetaGroup>
                </div>
            </div>
        </>
    );
}

const TL_META = {
    Created: { icon: FileText, desc: 'System generated' },
    Sent: { icon: Send, desc: 'Delivered to signer' },
    Viewed: { icon: Eye, desc: 'Opened by signer' },
    Signed: { icon: PenLine, desc: 'Signature captured' },
};

function TimelineRow({ label, value, isLast }) {
    const meta = TL_META[label] || {};
    const Icon = meta.icon || FileText;
    const has = !!value && value !== '–' && value !== '-';
    const full = label === 'Created'
        ? 'Document Created'
        : label === 'Sent'
            ? 'Document Sent'
            : label === 'Viewed'
                ? 'Signer Viewed'
                : 'Signer Signed';

    return (
        <div className={`flex items-center justify-between gap-3 rounded-[12px] px-2.5 py-2 ${!isLast ? 'mb-[6px]' : ''} ${has ? 'bg-white/78' : 'bg-white/50'}`}>
            <div className="flex min-w-0 items-center gap-[7px]" title={has ? String(value) : undefined}>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f3f6fa]">
                    <Icon className="h-[11px] w-[11px] text-[#98a2b3]" />
                </span>
                <span className="text-[11.5px] font-semibold text-[#303744]">{full}</span>
                {meta.desc && <span className="hidden text-[9px] text-[#b0b6c3] xl:inline">{meta.desc}</span>}
            </div>
            <span className={`shrink-0 text-[10.5px] tabular-nums ${tk.mono} ${has ? 'text-[#475467]' : 'text-[#d0d3da] italic'}`}>
                {has ? fmtTime(value) : '–'}
            </span>
        </div>
    );
}

function AuditPanel({ title, icon: Icon, children }) {
    return (
        <div className={`${tk.innerRadius} bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(249,250,252,0.92))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}>
            <SectionHdr icon={Icon}>{title}</SectionHdr>
            {children}
        </div>
    );
}

export function ProofDetailsGrid({ summary, auditTrail, verificationUrl, explorerUrl, anchorStatus }) {
    return (
        <div className={`${tk.sans} ${tk.outerRadius} ${tk.cardBorder} mt-4 overflow-hidden bg-[linear-gradient(180deg,#fffefd_0%,#fbfcfe_100%)] shadow-[0_8px_24px_rgba(15,23,42,0.03)]`}>
            <div className="border-b border-[#edf1f5] px-5 py-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#98a2b3]">Verification System</p>
                <h4 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#101828]">Verification Details</h4>
                <p className="mt-1 text-[12px] text-[#667085]">Machine-readable proof grouped by timeline, identity, and integrity.</p>
            </div>

            <div className="grid gap-px bg-[#edf1f5] p-px md:grid-cols-3">
                <AuditPanel title="Timeline" icon={CalendarClock}>
                    <TimelineRow label="Created" value={auditTrail?.documentCreatedAt} />
                    <TimelineRow label="Sent" value={auditTrail?.documentSentAt} />
                    <TimelineRow label="Viewed" value={auditTrail?.signerViewedAt} />
                    <TimelineRow label="Signed" value={auditTrail?.signerSignedAt || summary?.signedAt || summary?.signedTimestamp} isLast />
                </AuditPanel>

                <AuditPanel title="Identity" icon={Wallet}>
                    <CopyableValue label="Signer Wallet" value={auditTrail?.signerWalletAddress || summary?.signerAddress} truncate monospace />
                    <CopyableValue label="IP Address" value={auditTrail?.ipAddress} />
                    {(summary?.signer || auditTrail?.signerDisplayName) && (
                        <CopyableValue label="Signer" value={summary?.signer || auditTrail?.signerDisplayName} truncate className="mb-0" />
                    )}
                </AuditPanel>

                <AuditPanel title="Integrity / Blockchain" icon={Link2}>
                    <CopyableValue label="Document Hash" value={summary?.documentHash} truncate monospace />
                    <CopyableValue
                        label="Transaction Hash / Anchor"
                        value={summary?.transactionHash || auditTrail?.transactionHash || anchorStatus}
                        truncate
                        monospace
                    />
                    <CopyableValue label="Network / Chain" value={summary?.network || auditTrail?.chain} truncate />
                    <CopyableValue label="Agreement ID" value={summary?.agreementId || auditTrail?.agreementId} truncate monospace />
                    <div className="mb-[10px] rounded-[14px] border border-[#edf1f5] bg-white px-3 py-2.5">
                        <p className={tk.label}>Final Status</p>
                        <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#101828]">
                            {auditTrail?.finalStatus || summary?.finalStatus || anchorStatus || 'Pending'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {verificationUrl && (
                            <Link
                                href={verificationUrl}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-full border border-[#d3dae5] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#344054] transition hover:bg-[#f8fafc]"
                            >
                                <QrCode className="h-[10px] w-[10px]" /> Open Verify
                            </Link>
                        )}
                        {explorerUrl && (
                            <Link
                                href={explorerUrl}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-full border border-[#d3dae5] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#344054] transition hover:bg-[#f8fafc]"
                            >
                                <ExternalLink className="h-[10px] w-[10px]" /> View Explorer
                            </Link>
                        )}
                    </div>
                </AuditPanel>
            </div>
        </div>
    );
}

export function CompactAuditTrail({ auditTrail }) {
    return (
        <ProofDetailsGrid
            summary={{
                documentHash: auditTrail?.documentHash,
                transactionHash: auditTrail?.transactionHash,
                network: auditTrail?.chain,
                agreementId: auditTrail?.agreementId,
            }}
            auditTrail={auditTrail}
            anchorStatus={auditTrail?.finalStatus}
        />
    );
}

export function VerificationChecksCard({ checks }) {
    return (
        <div className={`${tk.sans} ${tk.innerRadius} ${tk.cardBorder} bg-[linear-gradient(180deg,#fffefd_0%,#fbfcfe_100%)] p-3.5`}>
            <SectionHdr icon={ShieldCheck}>Verification Checks</SectionHdr>
            <div className="space-y-[6px]">
                {checks.map(([label, passed]) => (
                    <div
                        key={label}
                        className="flex items-center justify-between gap-3 rounded-[14px] border border-[#edf1f5] bg-white px-3 py-2.5"
                    >
                        <p className="min-w-0 text-[11px] leading-snug text-[#4a5063]">{label}</p>
                        <span className={`shrink-0 inline-flex items-center gap-[4px] rounded-full border px-[8px] py-[3px] text-[8px] font-bold uppercase tracking-[0.1em] leading-none ${passed === true
                            ? 'border-[#b7ebd0] bg-[#ecfdf3] text-[#18794e]'
                            : passed === false
                                ? 'border-[#fecaca] bg-[#fef2f2] text-[#b42318]'
                                : 'border-[#f5d98c] bg-[#fffbeb] text-[#92640d]'
                            }`}>
                            <span className={`h-[4px] w-[4px] rounded-full ${passed === true ? 'bg-emerald-400' : passed === false ? 'bg-red-400' : 'bg-amber-400'}`} />
                            {passed === true ? 'Pass' : passed === false ? 'Fail' : 'Pending'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
