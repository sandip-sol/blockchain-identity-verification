'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import Navbar from '../../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../../components/Card';
import StatusBadge from '../../../../components/StatusBadge';
import { useAuth } from '../../../../context/AuthContext';
import { useAPI } from '../../../../hooks/useAPI';
import { canAccessAdmin, canFinalizeKyc } from '../../../../utils/rbac';

export default function AdminKycDetailPage({ params }) {
  const applicationId = params?.id;
  const router = useRouter();
  const auth = useAuth();
  const api = useAPI();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState(null);

  const role = auth.account?.normalizedRole || auth.account?.role;
  const canFinalize = canFinalizeKyc(role);
  const application = detail?.application;
  const audit = detail?.audit || [];

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/admin/kyc/${applicationId}`);
      setDetail(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.hydrated && !canAccessAdmin(role)) {
      router.push('/dashboard');
    }
  }, [auth.hydrated, role, router]);

  useEffect(() => {
    if (auth.hydrated && canAccessAdmin(role) && applicationId) {
      loadDetail();
    }
  }, [auth.hydrated, role, applicationId]);

  const actionsDisabled = useMemo(() => ({
    review: !['SUBMITTED', 'RESUBMISSION_REQUIRED'].includes(application?.status),
    approve: !canFinalize || !['SUBMITTED', 'UNDER_REVIEW'].includes(application?.status),
    reject: !canFinalize || ['VERIFIED'].includes(application?.status),
    resubmit: !canFinalize || ['VERIFIED'].includes(application?.status),
    verify: !canFinalize || application?.status !== 'APPROVED',
  }), [application?.status, canFinalize]);

  async function handleAction(kind) {
    try {
      setActionLoading(kind);
      if (kind === 'underReview') {
        await api.patch(`/api/admin/kyc/${applicationId}/status`, { note: note || 'Review started by admin.' });
      } else if (kind === 'approve') {
        await api.post(`/api/admin/kyc/${applicationId}/approve`, { note });
      } else if (kind === 'reject') {
        await api.post(`/api/admin/kyc/${applicationId}/reject`, { note });
      } else if (kind === 'resubmit') {
        await api.post(`/api/admin/kyc/${applicationId}/request-resubmission`, { note });
      } else if (kind === 'verify') {
        await api.post(`/api/admin/kyc/${applicationId}/verify-onchain`, { expiryYears: 2, retryFailed: true });
      }

      setToast({ type: 'success', message: 'Action completed successfully.' });
      setModal(null);
      setNote('');
      await loadDetail();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Action failed' });
    } finally {
      setActionLoading(null);
    }
  }

  if (!auth.hydrated || !canAccessAdmin(role)) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/admin/kyc" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-3">
              <ArrowLeft className="w-4 h-4" />
              Back to review queue
            </Link>
            <h1 className="text-4xl font-bold text-gradient">{applicationId}</h1>
            <p className="text-gray-400 mt-2">Review metadata, audit trail, and blockchain verification state for this KYC case.</p>
          </div>
          <button onClick={() => loadDetail()} className="secondary-button px-4 py-2 inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {toast && (
          <div className={`glass-card p-4 border ${toast.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-green-500/30 bg-green-500/10 text-green-200'}`}>
            {toast.message}
          </div>
        )}

        {error && (
          <div className="glass-card p-4 border-red-500/20 bg-red-500/10 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <Card><CardContent className="py-16 text-center text-gray-400">Loading application...</CardContent></Card>
        ) : !application ? (
          <Card><CardContent className="py-16 text-center text-gray-400">Application not found.</CardContent></Card>
        ) : (
          <>
            <div className="grid xl:grid-cols-[1.4fr_0.9fr] gap-6">
              <Card>
                <CardHeader title="Application Summary" subtitle="Applicant data, storage references, and review state" />
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={application.status} />
                    <span className="text-sm text-gray-400">Risk: {application.currentRiskLevel || 'UNKNOWN'}</span>
                    <span className="text-sm text-gray-400">Type: {application.verificationType}</span>
                  </div>

                  <DetailGrid rows={[
                    ['Applicant', application.summary?.fullName || application.summary?.businessName || '—'],
                    ['Email', application.summary?.email || application.userId?.email || '—'],
                    ['Phone', application.summary?.phoneNumber || '—'],
                    ['Wallet', application.walletAddress || '—'],
                    ['Submitted At', formatDate(application.submittedAt)],
                    ['Reviewed At', formatDate(application.reviewedAt)],
                    ['Reviewed By', application.reviewedBy?.email || '—'],
                    ['Approved At', formatDate(application.approvedAt)],
                    ['Rejected At', formatDate(application.rejectedAt)],
                    ['Verified At', formatDate(application.verifiedAt)],
                    ['IPFS CID', application.ipfsCid || '—'],
                    ['Data Hash', application.dataHash || '—'],
                  ]} />

                  {(application.rejectionReason || application.resubmissionReason || application.failureReason || application.reviewNotes) && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <NotesCard label="Review Notes" value={application.reviewNotes} />
                      <NotesCard label="Rejection Reason" value={application.rejectionReason} />
                      <NotesCard label="Resubmission Reason" value={application.resubmissionReason} />
                      <NotesCard label="Failure Reason" value={application.failureReason} />
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Document Metadata</h3>
                    <div className="space-y-3">
                      {application.documents?.length ? application.documents.map((doc) => (
                        <div key={doc._id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <p className="text-white font-medium">{doc.type}</p>
                            <p className="text-xs text-gray-500">{doc.mimeType || 'unknown mime'}</p>
                          </div>
                          <p className="text-sm text-gray-300">{doc.originalFilename || 'Unnamed file'}</p>
                          <p className="text-xs font-mono text-gray-500 mt-2 break-all">{doc.hash || 'No hash stored'}</p>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">No document metadata available.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader title="Review Actions" subtitle="Guarded state transitions with confirmation and notes" />
                  <CardContent className="space-y-3">
                    <button
                      onClick={() => { setModal('underReview'); setNote('Review started by admin.'); }}
                      disabled={actionsDisabled.review}
                      className="secondary-button w-full py-3 disabled:opacity-40"
                    >
                      Mark Under Review
                    </button>
                    <button
                      onClick={() => { setModal('approve'); setNote(''); }}
                      disabled={actionsDisabled.approve}
                      className="primary-button w-full py-3 disabled:opacity-40"
                    >
                      Approve Application
                    </button>
                    <button
                      onClick={() => { setModal('reject'); setNote(''); }}
                      disabled={actionsDisabled.reject}
                      className="secondary-button w-full py-3 text-red-300 border-red-400/20 disabled:opacity-40"
                    >
                      Reject Application
                    </button>
                    <button
                      onClick={() => { setModal('resubmit'); setNote(''); }}
                      disabled={actionsDisabled.resubmit}
                      className="secondary-button w-full py-3 text-amber-200 border-amber-400/20 disabled:opacity-40"
                    >
                      Request Resubmission
                    </button>
                    <button
                      onClick={() => { setModal('verify'); setNote(''); }}
                      disabled={actionsDisabled.verify}
                      className="secondary-button w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                      Verify On-Chain
                    </button>
                    {!canFinalize && (
                      <p className="text-xs text-gray-500">Your role can review this case but cannot finalize approval or on-chain verification.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Blockchain Result" subtitle="Transaction lifecycle and final identity issuance state" />
                  <CardContent className="space-y-3">
                    <DetailRow label="Tx Status" value={application.verificationTxStatus || 'NONE'} />
                    <DetailRow label="Tx Hash" value={application.verificationTxHash || '—'} mono />
                    <DetailRow label="Token ID" value={application.verificationTokenId || '—'} mono />
                    <DetailRow label="Block Number" value={application.verificationBlockNumber || '—'} />
                    <DetailRow label="Chain ID" value={application.verificationChainId || '—'} />
                    <DetailRow label="Verifier Wallet" value={application.verifierWallet || '—'} mono />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Status Timeline" subtitle="Latest audit events first" />
                  <CardContent className="space-y-4">
                    {audit.length ? audit.slice(0, 8).map((entry) => (
                      <div key={entry._id} className="border-l border-white/10 pl-4">
                        <p className="text-sm text-white">{entry.action}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(entry.createdAt)} • {entry.actorRole || 'SYSTEM'}</p>
                        {entry.note && <p className="text-sm text-gray-300 mt-2">{entry.note}</p>}
                      </div>
                    )) : (
                      <p className="text-sm text-gray-400">No audit history recorded yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader title="Full Audit History" subtitle="Immutable event stream for reviewers and auditors" />
              <CardContent>
                {audit.length ? (
                  <div className="space-y-3">
                    {audit.map((entry) => (
                      <div key={entry._id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-white font-medium">{entry.action}</p>
                            <p className="text-xs text-gray-500">{formatDate(entry.createdAt)} • {entry.actorRole || 'SYSTEM'}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{entry.fromStatus || '—'}</span>
                            <span>→</span>
                            <span>{entry.toStatus || '—'}</span>
                          </div>
                        </div>
                        {entry.note && <p className="text-sm text-gray-300 mt-3">{entry.note}</p>}
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <pre className="mt-3 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(entry.metadata, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No audit history recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {modal && (
        <ActionModal
          kind={modal}
          note={note}
          setNote={setNote}
          busy={actionLoading === modal}
          onClose={() => { setModal(null); setNote(''); }}
          onConfirm={() => handleAction(modal)}
        />
      )}
    </div>
  );
}

function ActionModal({ kind, note, setNote, busy, onClose, onConfirm }) {
  const config = {
    underReview: {
      icon: Clock3,
      title: 'Move to Under Review',
      description: 'This records that an admin has actively picked up the case.',
      requiresNote: true,
      confirmLabel: 'Start Review',
      buttonClass: 'primary-button',
    },
    approve: {
      icon: CheckCircle2,
      title: 'Approve Application',
      description: 'Approval unlocks the on-chain verification step but does not mint yet.',
      requiresNote: false,
      confirmLabel: 'Approve',
      buttonClass: 'primary-button',
    },
    reject: {
      icon: XCircle,
      title: 'Reject Application',
      description: 'A rejection reason is required and will be visible in the audit trail.',
      requiresNote: true,
      confirmLabel: 'Reject',
      buttonClass: 'secondary-button text-red-300 border-red-400/20',
    },
    resubmit: {
      icon: AlertCircle,
      title: 'Request Resubmission',
      description: 'A clear note is required so the applicant knows what to correct.',
      requiresNote: true,
      confirmLabel: 'Request Resubmission',
      buttonClass: 'secondary-button text-amber-200 border-amber-400/20',
    },
    verify: {
      icon: ShieldCheck,
      title: 'Verify On-Chain',
      description: 'This triggers the privileged backend signer to mint the identity token and finalize the case.',
      requiresNote: false,
      confirmLabel: 'Trigger Verification',
      buttonClass: 'primary-button',
    },
  }[kind];

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0e1220] p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">{config.title}</h3>
            <p className="text-sm text-gray-400">{config.description}</p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add reviewer notes"
          className="input-field min-h-[140px] w-full"
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="secondary-button px-4 py-2">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy || (config.requiresNote && note.trim().length < 3)}
            className={`${config.buttonClass} px-4 py-2 disabled:opacity-40`}
          >
            {busy ? 'Working...' : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailGrid({ rows }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {rows.map(([label, value]) => (
        <DetailRow key={label} label={label} value={value} mono={label.includes('Hash') || label === 'Wallet' || label === 'IPFS CID'} />
      ))}
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-sm text-gray-200 break-all ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function NotesCard({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-sm text-gray-200 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
