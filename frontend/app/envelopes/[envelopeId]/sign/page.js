'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccount, useSignTypedData } from 'wagmi';
import { toast } from 'react-toastify';
import { ArrowLeft, FileText, PenLine, Send, ShieldCheck, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react';

import Navbar from '../../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../../components/Card';
import { useAPI } from '../../../../hooks/useAPI';
import { useAuth } from '../../../../context/AuthContext';

function signerStateCopy(recipient) {
    switch (recipient?.signingState) {
        case 'READY_TO_SIGN':
            return 'Ready to sign';
        case 'WAITING_FOR_PREVIOUS_SIGNER':
            return 'Waiting for previous signer';
        case 'SIGNED':
            return 'Already signed';
        case 'EXPIRED':
            return 'Envelope expired';
        case 'VOIDED':
            return 'Envelope voided';
        default:
            return recipient?.status || 'Pending';
    }
}

export default function SignEnvelopePage() {
    const api = useAPI();
    const { isAuthenticated, account, setAccountData } = useAuth();
    const params = useParams();
    const search = useSearchParams();
    const envelopeId = params?.envelopeId;
    const recipientFromQuery = search?.get('recipient') || '';

    const { address, isConnected } = useAccount();
    const { signTypedDataAsync } = useSignTypedData();

    const [envData, setEnvData] = useState(null);
    const [typed, setTyped] = useState(null);
    const [loading, setLoading] = useState(false);
    const [docLoading, setDocLoading] = useState(false);
    const [signatureUploading, setSignatureUploading] = useState(false);

    const recipientAddress = useMemo(() => {
        return (recipientFromQuery || address || '').toLowerCase();
    }, [recipientFromQuery, address]);

    const loadEnvelope = async () => {
        if (!envelopeId) return;
        const resp = await api.get(`/api/envelopes/${envelopeId}`);
        setEnvData(resp);
        return resp;
    };

    useEffect(() => {
        if (!envelopeId || !isAuthenticated) return;
        (async () => {
            try {
                await loadEnvelope();
            } catch (e) {
                toast.error(e?.response?.data?.error || e.message || 'Failed to load envelope');
            }
        })();
    }, [envelopeId, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        (async () => {
            try {
                const resp = await api.get('/api/auth/me');
                if (resp?.account) setAccountData(resp.account);
            } catch (_) {
                // Keep current account snapshot if profile refresh fails.
            }
        })();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!envelopeId || !recipientAddress || !isAuthenticated) return;
        (async () => {
            try {
                const resp = await api.get(`/api/envelopes/${envelopeId}/typed-data`, {
                    params: { recipientAddress },
                });
                setTyped(resp);
            } catch (e) {
                setTyped(null);
            }
        })();
    }, [envelopeId, recipientAddress, isAuthenticated]);

    const env = envData?.envelope;
    const recipients = envData?.recipients || [];
    const myRecipient = recipients.find((r) => String(r.recipientAddress).toLowerCase() === recipientAddress);

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

    const doSign = async () => {
        if (!isAuthenticated) {
            toast.error('Sign in before signing an envelope');
            return;
        }
        if (!isConnected || !address) {
            toast.error('Connect the wallet that should sign this envelope');
            return;
        }
        if (recipientFromQuery && address.toLowerCase() !== recipientFromQuery.toLowerCase()) {
            toast.error('Switch to the wallet assigned to this envelope recipient');
            return;
        }
        if (!myRecipient?.canSignNow) {
            toast.error('This envelope is not ready for your signature yet');
            return;
        }
        if (!typed?.domain || !typed?.types || !typed?.message) {
            toast.error('Unable to load signing data. Refresh the page.');
            return;
        }
        setLoading(true);
        try {
            const signature = await signTypedDataAsync({
                domain: typed.domain,
                types: typed.types,
                primaryType: typed.primaryType || 'EnvelopeSign',
                message: typed.message,
            });

            await api.post(`/api/envelopes/${envelopeId}/sign`, {
                recipientAddress: address,
                signature,
                placement: {
                    pageIndex: 0,
                    x: 50,
                    y: 50,
                    width: 180,
                    height: 70,
                },
            });

            toast.success('Signed successfully');
            const refreshed = await loadEnvelope();
            setEnvData(refreshed);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Signing failed');
        } finally {
            setLoading(false);
        }
    };

    const onUploadSignature = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'image/png') {
            toast.error('Upload a PNG signature image');
            event.target.value = '';
            return;
        }

        setSignatureUploading(true);
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = String(reader.result || '');
                    resolve(result.includes(',') ? result.split(',')[1] : result);
                };
                reader.onerror = () => reject(reader.error || new Error('Failed to read signature image'));
                reader.readAsDataURL(file);
            });

            const resp = await api.post('/api/auth/signature', {
                signatureImageBase64: base64,
            });
            if (resp?.account) setAccountData(resp.account);
            toast.success('Reusable account signature uploaded');
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to upload signature');
        } finally {
            setSignatureUploading(false);
            event.target.value = '';
        }
    };

    const walletMismatch = Boolean(recipientFromQuery && address && address.toLowerCase() !== recipientFromQuery.toLowerCase());

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold text-gradient mb-1">Sign Envelope</h1>
                        <p className="text-gray-400 break-all">Envelope ID: {envelopeId}</p>
                        {recipientFromQuery && (
                            <p className="text-gray-400 text-sm break-all">Assigned recipient wallet: {recipientFromQuery}</p>
                        )}
                    </div>
                    <Link href={`/envelopes/${envelopeId}`} className="text-gray-300 hover:text-white inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Link>
                </div>

                {!isAuthenticated ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">Sign in to access this envelope.</CardContent>
                    </Card>
                ) : !env ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">Loading…</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader title="Signing State" subtitle="Current signing eligibility and legal proof model" />
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400 text-sm">Your status</p>
                                        <p className="text-white font-medium mt-1">{signerStateCopy(myRecipient)}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400 text-sm">Next action</p>
                                        <p className="text-white font-medium mt-1">{env.nextAction}</p>
                                    </div>
                                </div>
                                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-200">
                                    <div className="flex items-start gap-2">
                                        <ShieldCheck className="w-4 h-4 mt-0.5" />
                                        <p>
                                            Your wallet signature approves the canonical source document hash. If your account has a stored signature image, the backend attaches that approved image to the rendered PDF automatically.
                                        </p>
                                    </div>
                                </div>
                                {walletMismatch && (
                                    <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                                            <p>
                                                Connected wallet: <span className="font-mono">{address}</span><br />
                                                Assigned wallet: <span className="font-mono">{recipientFromQuery}</span><br />
                                                Switch wallets before signing.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Document" subtitle="Review the protected source document before signing" />
                            <CardContent>
                                <div className="flex flex-wrap gap-3">
                                    {envData?.documents?.original && (
                                        <button
                                            type="button"
                                            onClick={() => openDocument('original')}
                                            disabled={docLoading}
                                            className="primary-button inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FileText className="w-5 h-5" /> Open Source Document
                                        </button>
                                    )}
                                    {envData?.documents?.final && (
                                        <button
                                            type="button"
                                            onClick={() => openDocument('final')}
                                            disabled={docLoading}
                                            className="secondary-button inline-flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FileText className="w-5 h-5" /> Open Current Rendered PDF
                                        </button>
                                    )}
                                </div>
                                {typed?.canonicalDocumentHash && (
                                    <p className="text-xs text-gray-400 mt-4 break-all">
                                        Canonical source hash: <span className="text-gray-200">{typed.canonicalDocumentHash}</span>
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Stored Signature" subtitle="Your account-level signature image is attached automatically when available" />
                            <CardContent>
                                <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div>
                                            <p className="text-white font-medium">
                                                {account?.signatureAsset?.hasSignature ? 'Signature on file' : 'No signature uploaded'}
                                            </p>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Only the authenticated account owner can upload it, and it is locked to the linked wallet address.
                                            </p>
                                            {account?.signatureAsset?.hasSignature && (
                                                <p className="text-xs text-gray-400 mt-2">
                                                    Uploaded: {account.signatureAsset.uploadedAt ? new Date(account.signatureAsset.uploadedAt).toLocaleString() : '-'}
                                                </p>
                                            )}
                                        </div>
                                        {account?.signatureAsset?.hasSignature ? (
                                            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm text-green-300">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Ready to attach
                                            </div>
                                        ) : null}
                                    </div>

                                    <label className="secondary-button inline-flex items-center gap-2 cursor-pointer w-fit">
                                        <Upload className="w-4 h-4" />
                                        {signatureUploading ? 'Uploading...' : 'Upload Account Signature'}
                                        <input
                                            type="file"
                                            accept="image/png"
                                            className="hidden"
                                            disabled={signatureUploading}
                                            onChange={onUploadSignature}
                                        />
                                    </label>
                                    <p className="text-xs text-gray-400">
                                        Use a clean PNG only. The backend enforces file type, size, and image-dimension checks before storing it.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Sign" subtitle="Signs EIP-712 typed data for the canonical source document" />
                            <CardContent>
                                <button
                                    type="button"
                                    onClick={doSign}
                                    disabled={loading || !myRecipient?.canSignNow || walletMismatch}
                                    className="primary-button inline-flex items-center gap-2 disabled:opacity-50"
                                >
                                    <PenLine className="w-5 h-5" />
                                    Sign Now
                                    <Send className="w-5 h-5" />
                                </button>

                                {typed?.typedDataHash && (
                                    <div className="mt-4 text-xs text-gray-400 break-all">
                                        TypedData Hash: <span className="text-gray-200">{typed.typedDataHash}</span>
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
