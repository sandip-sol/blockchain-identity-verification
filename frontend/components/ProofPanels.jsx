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

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS  –  Enterprise legal-tech / trust-product palette
   ═══════════════════════════════════════════════════════════════ */

const tk = {
    // font families
    mono: "font-['IBM_Plex_Mono',ui-monospace,monospace]",
    // label style
    label: 'text-[9px] font-semibold uppercase tracking-[0.13em] text-[#8e95a2] leading-none mb-[4px]',
    // value style
    value: 'text-[12px] font-semibold text-[#1e2533] leading-[1.35]',
    // section header
    sectionHdr: 'flex items-center gap-[5px] mb-[10px]',
    sectionIcon: 'w-3 h-3 text-[#b0b6c3]',
    sectionLabel: 'text-[8.5px] font-bold uppercase tracking-[0.15em] text-[#a0a7b4]',
    // card borders / radii
    cardBorder: 'border border-[#e8eaef]',
    innerBorder: 'border-[#eceef3]',
    outerRadius: 'rounded-[22px]',
    innerRadius: 'rounded-xl',
};

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

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
    } catch { return String(val); }
}

/* ═══════════════════════════════════════════════════════════════
   CopyableValue – compact label / value / copy
   ═══════════════════════════════════════════════════════════════ */

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
            <div className="flex items-center gap-1 min-w-0">
                <span
                    title={raw || undefined}
                    className={`${tk.value} min-w-0 ${truncate ? 'truncate' : 'break-all'} ${monospace ? tk.mono + ' text-[11px] font-medium' : ''}`}
                >
                    {display}
                </span>
                {raw && (
                    <button
                        type="button"
                        onClick={copy}
                        className="shrink-0 p-0.5 rounded text-[#c4c9d4] hover:text-[#6b7280] transition-colors"
                        title={copied ? 'Copied!' : 'Copy'}
                    >
                        {copied
                            ? <Check className="w-[11px] h-[11px] text-emerald-500" />
                            : <Copy className="w-[11px] h-[11px]" />}
                    </button>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Section header with icon
   ═══════════════════════════════════════════════════════════════ */

function SectionHdr({ icon: Icon, children }) {
    return (
        <div className={tk.sectionHdr}>
            <Icon className={tk.sectionIcon} />
            <span className={tk.sectionLabel}>{children}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Signature modal
   ═══════════════════════════════════════════════════════════════ */

function SignatureModal({ open, onClose, signatureImageUrl, signer, signerAddress, signedAt }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return;
        const fn = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [open, onClose]);
    if (!open) return null;

    return (
        <div ref={ref} onClick={(e) => e.target === ref.current && onClose()}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-[340px] rounded-2xl border border-[#e4e7ec] bg-white p-5 shadow-xl">
                <button onClick={onClose}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center text-[#b0b6c3] hover:text-[#555] hover:bg-[#f3f4f6] transition">
                    <X className="w-3.5 h-3.5" />
                </button>
                <p className={tk.label + ' mb-2'}>Signature Preview</p>
                <div className="rounded-xl border border-dashed border-[#dde0e7] bg-[#fafbfc] p-4 flex items-center justify-center min-h-[90px]">
                    {signatureImageUrl
                        ? <img src={signatureImageUrl} alt="Signature" className="max-h-[90px] max-w-full object-contain" />
                        : <p className="text-[#c8cdd6] text-xs italic">No image</p>}
                </div>
                <div className="mt-3 space-y-1.5">
                    {signer && <CopyableValue label="Signer" value={signer} />}
                    {signerAddress && <CopyableValue label="Wallet" value={signerAddress} truncate monospace />}
                    {signedAt && <CopyableValue label="Signed" value={signedAt} />}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Status pill
   ═══════════════════════════════════════════════════════════════ */

function StatusPill({ status }) {
    if (!status) return null;
    const lower = String(status).toLowerCase();
    const isGreen = lower.includes('signed') || lower.includes('verified') || lower.includes('completed');
    const isAmber = lower.includes('pending') || lower.includes('anchor');
    const isRed = lower.includes('failed') || lower.includes('rejected');

    const colors = isGreen
        ? 'bg-[#ecfdf3] text-[#18794e] border-[#b7ebd0]'
        : isAmber
            ? 'bg-[#fffbeb] text-[#92640d] border-[#f5d98c]'
            : isRed
                ? 'bg-[#fef2f2] text-[#b42318] border-[#fecaca]'
                : 'bg-[#f4f5f7] text-[#5e6577] border-[#e1e4ea]';

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-[4px] text-[9px] font-bold uppercase tracking-[0.11em] leading-none ${colors}`}>
            {status}
        </span>
    );
}

function MetaGroup({ title, icon: Icon, children, className = '' }) {
    return (
        <section className={`min-w-0 rounded-[16px] border border-[#eceef3] bg-[#fcfcfd] p-3 ${className}`}>
            <SectionHdr icon={Icon}>{title}</SectionHdr>
            {children}
        </section>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ProofHero  –  MAIN CARD
   ═══════════════════════════════════════════════════════════════ */

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

            <div className={`${tk.outerRadius} ${tk.cardBorder} overflow-hidden bg-[#fffefd] shadow-[0_1px_2px_rgba(15,23,42,0.03)]`}>
                <div className="flex items-center justify-between gap-3 border-b border-[#eceef3] bg-[#fbfbfa] px-4 py-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e7ec] bg-white">
                                <Lock className="h-3.5 w-3.5 text-[#667085]" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#98a2b3]">Signature Proof</p>
                                <h3 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[#101828]">
                                    {title || 'Proof of Signature'}
                                </h3>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <StatusPill status={signedStatus} />
                        <StatusPill status={anchorStatus} />
                        {actions}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_172px]">
                    <MetaGroup title="Signature" icon={PenLine} className="flex flex-col items-center justify-between text-center">
                        <div className="flex w-full min-h-[78px] items-center justify-center rounded-[14px] border border-dashed border-[#d9dee7] bg-white px-2.5 py-3">
                            {signatureImageUrl ? (
                                <img src={signatureImageUrl} alt="Signature" className="max-h-[52px] max-w-full object-contain" />
                            ) : (
                                <svg width="44" height="20" viewBox="0 0 48 24" fill="none" className="text-[#cdd1da]">
                                    <path d="M4 18 C8 6, 14 6, 16 14 S24 22, 28 12 S36 2, 40 10 S46 16, 44 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setSigModal(true)}
                            className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#667085] transition hover:text-[#344054]"
                        >
                            <Eye className="h-3 w-3" />
                            View Signature
                        </button>
                    </MetaGroup>

                    <MetaGroup title="Signing Details" icon={Fingerprint}>
                        <CopyableValue label="Signer" value={signer || signerAddress} truncate monospace={!signer} />
                        <CopyableValue label="Signed At" value={signedAt} />
                        <div className="mb-[10px]">
                            <p className={tk.label}>Status</p>
                            <p className={tk.value}>{signedStatus || 'Pending'}</p>
                        </div>
                        <CopyableValue label="Agreement ID" value={agreementId} truncate monospace />
                    </MetaGroup>

                    <MetaGroup title="Document Integrity" icon={FileCheck2}>
                        <CopyableValue label="Document Hash" value={documentHash} truncate monospace />
                        <CopyableValue label="IP Address" value={ipAddress} truncate={false} monospace={String(ipAddress || '').includes(':')} />
                        <div className="mb-0">
                            <p className={tk.label}>Verification</p>
                            <div className="flex items-center gap-2">
                                <BadgeCheck className="h-3.5 w-3.5 text-[#12b76a]" />
                                <p className={tk.value}>
                                    {anchorStatus
                                        ? `${anchorStatus}${signedStatus ? ` • ${signedStatus}` : ''}`
                                        : signedStatus || 'Pending'}
                                </p>
                            </div>
                        </div>
                    </MetaGroup>

                    <MetaGroup title="Blockchain" icon={Hash}>
                        <div className="flex items-start gap-3">
                            <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[14px] border border-[#e4e7ec] bg-white">
                                {verificationUrl ? (
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&margin=0&data=${encodeURIComponent(verificationUrl)}`}
                                        alt="Verification QR"
                                        className="h-[60px] w-[60px] rounded-[8px]"
                                    />
                                ) : (
                                    <QrCode className="h-7 w-7 text-[#c4cad4]" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <CopyableValue label="Transaction" value={transactionHash || anchorStatus} truncate monospace />
                                <CopyableValue label="Network / Chain" value={network} truncate />
                                <CopyableValue label="Signer Wallet" value={signerAddress} truncate monospace />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-[12px] border border-[#eceef3] bg-white px-2.5 py-2">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#98a2b3]">Scan to verify</p>
                                <p className="truncate text-[11px] font-medium text-[#475467]" title={verificationUrl || undefined}>
                                    {verificationUrl || 'Verification link unavailable'}
                                </p>
                            </div>
                            {verificationUrl && (
                                <Link
                                    href={verificationUrl}
                                    target="_blank"
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d0d5dd] bg-[#fcfcfd] px-2.5 py-1 text-[10px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
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

/* ═══════════════════════════════════════════════════════════════
   Timeline row
   ═══════════════════════════════════════════════════════════════ */

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
    const full = label === 'Created' ? 'Document Created'
        : label === 'Sent' ? 'Document Sent'
            : label === 'Viewed' ? 'Signer Viewed'
                : 'Signer Signed';

    return (
        <div className={`flex items-center justify-between gap-2 ${!isLast ? 'mb-[8px]' : ''}`}>
            <div className="flex items-center gap-[6px] min-w-0" title={has ? String(value) : undefined}>
                <Icon className="w-[11px] h-[11px] text-[#c0c5d0] shrink-0" />
                <span className="text-[11.5px] font-semibold text-[#303744]">{full}</span>
                {meta.desc && <span className="text-[9.5px] text-[#b0b6c3] hidden sm:inline">{meta.desc}</span>}
            </div>
            <span className={`shrink-0 text-[11px] tabular-nums ${tk.mono} ${has ? 'text-[#6b7280]' : 'text-[#d0d3da] italic'}`}>
                {has ? fmtTime(value) : '–'}
            </span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Audit panel wrapper
   ═══════════════════════════════════════════════════════════════ */

function AuditPanel({ title, icon: Icon, children }) {
    return (
        <div className={`${tk.innerRadius} ${tk.cardBorder} bg-[#fcfcfd] p-3`}>
            <SectionHdr icon={Icon}>{title}</SectionHdr>
            {children}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ProofDetailsGrid  –  3-panel audit section
   ═══════════════════════════════════════════════════════════════ */

export function ProofDetailsGrid({ summary, auditTrail, verificationUrl, explorerUrl, anchorStatus }) {
    return (
        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
            {/* Timeline */}
            <AuditPanel title="Timeline" icon={CalendarClock}>
                <TimelineRow label="Created" value={auditTrail?.documentCreatedAt} />
                <TimelineRow label="Sent" value={auditTrail?.documentSentAt} />
                <TimelineRow label="Viewed" value={auditTrail?.signerViewedAt} />
                <TimelineRow label="Signed" value={auditTrail?.signerSignedAt || summary?.signedAt || summary?.signedTimestamp} isLast />
            </AuditPanel>

            {/* Identity */}
            <AuditPanel title="Identity" icon={Wallet}>
                <CopyableValue label="Signer Wallet" value={auditTrail?.signerWalletAddress || summary?.signerAddress} truncate monospace />
                <CopyableValue label="IP Address" value={auditTrail?.ipAddress} />
                {(summary?.signer || auditTrail?.signerDisplayName) && (
                    <CopyableValue label="Signer" value={summary?.signer || auditTrail?.signerDisplayName} truncate />
                )}
            </AuditPanel>

            {/* Integrity */}
            <AuditPanel title="Integrity" icon={Link2}>
                <CopyableValue label="Document Hash" value={summary?.documentHash} truncate monospace />
                <CopyableValue label="Transaction Hash / Anchor" value={summary?.transactionHash || auditTrail?.transactionHash || anchorStatus} truncate monospace />
                <CopyableValue label="Network / Chain" value={summary?.network || auditTrail?.chain} truncate />
                <CopyableValue label="Agreement ID" value={summary?.agreementId || auditTrail?.agreementId} truncate monospace />
                <div className="mb-[10px]">
                    <p className={tk.label}>Final Status</p>
                    <p className={tk.value}>{auditTrail?.finalStatus || summary?.finalStatus || anchorStatus || 'Pending'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {verificationUrl && (
                        <Link
                            href={verificationUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#475467] transition hover:text-[#111827]"
                        >
                            <QrCode className="h-[10px] w-[10px]" /> Open Verify
                        </Link>
                    )}
                    {explorerUrl && (
                        <Link
                            href={explorerUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#475467] transition hover:text-[#111827]"
                        >
                            <ExternalLink className="h-[10px] w-[10px]" /> View Explorer
                        </Link>
                    )}
                </div>
            </AuditPanel>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   CompactAuditTrail  –  backward compat wrapper
   ═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   VerificationChecksCard
   ═══════════════════════════════════════════════════════════════ */

export function VerificationChecksCard({ checks }) {
    return (
        <div className={`${tk.innerRadius} ${tk.cardBorder} bg-white p-3`}>
            <SectionHdr icon={ShieldCheck}>Verification Checks</SectionHdr>
            <div className="space-y-[5px]">
                {checks.map(([label, passed]) => (
                    <div key={label}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#eceef3] bg-[#fafbfc] px-2.5 py-[6px]">
                        <p className="text-[11px] text-[#4a5063] leading-snug min-w-0">{label}</p>
                        <span className={`shrink-0 inline-flex items-center gap-[3px] rounded-full border px-[7px] py-[2px] text-[8px] font-bold uppercase tracking-[0.1em] leading-none ${passed === true
                                ? 'bg-[#ecfdf3] text-[#18794e] border-[#b7ebd0]'
                                : passed === false
                                    ? 'bg-[#fef2f2] text-[#b42318] border-[#fecaca]'
                                    : 'bg-[#fffbeb] text-[#92640d] border-[#f5d98c]'
                            }`}>
                            <span className={`w-[4px] h-[4px] rounded-full ${passed === true ? 'bg-emerald-400' : passed === false ? 'bg-red-400' : 'bg-amber-400'
                                }`} />
                            {passed === true ? 'Pass' : passed === false ? 'Fail' : 'Pending'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
