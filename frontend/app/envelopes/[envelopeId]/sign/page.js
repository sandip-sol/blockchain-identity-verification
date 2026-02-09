'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccount, useSignTypedData } from 'wagmi';
import { toast } from 'react-toastify';
import { ArrowLeft, FileText, PenLine, ExternalLink, Send } from 'lucide-react';

import Navbar from '../../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../../components/Card';
import SignaturePad from '../../../../components/SignaturePad';
import { useAPI } from '../../../../hooks/useAPI';

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';

export default function SignEnvelopePage() {
    const api = useAPI();
    const params = useParams();
    const search = useSearchParams();
    const envelopeId = params?.envelopeId;
    const recipientFromQuery = search?.get('recipient') || '';

    const { address, isConnected } = useAccount();
    const { signTypedDataAsync } = useSignTypedData();

    const [envData, setEnvData] = useState(null);
    const [typed, setTyped] = useState(null);
    const [sigBase64, setSigBase64] = useState(null);
    const [loading, setLoading] = useState(false);

    const recipientAddress = useMemo(() => {
        // If recipient is in URL, use that. Otherwise default to connected wallet.
        return (recipientFromQuery || address || '').toLowerCase();
    }, [recipientFromQuery, address]);

    useEffect(() => {
        if (!envelopeId) return;
        (async () => {
            try {
                const resp = await api.get(`/api/envelopes/${envelopeId}`);
                setEnvData(resp);
            } catch (e) {
                toast.error(e?.response?.data?.error || e.message || 'Failed to load envelope');
            }
        })();
    }, [envelopeId]);

    useEffect(() => {
        if (!envelopeId || !recipientAddress) return;
        (async () => {
            try {
                const resp = await api.get(`/api/envelopes/${envelopeId}/typed-data`, {
                    params: { recipientAddress },
                });
                setTyped(resp);
            } catch (e) {
                // Avoid spamming toast until wallet connected
                console.error(e);
            }
        })();
    }, [envelopeId, recipientAddress]);

    const env = envData?.envelope;
    const recipients = envData?.recipients || [];
    const myRecipient = recipients.find((r) => String(r.recipientAddress).toLowerCase() === recipientAddress);

    const docUrl = useMemo(() => {
        const cid = env?.documentFinalCID || env?.documentOriginalCID;
        return cid ? `${IPFS_GATEWAY}${cid}` : null;
    }, [env?.documentFinalCID, env?.documentOriginalCID]);

    const doSign = async () => {
        if (!isConnected || !address) {
            toast.error('Connect the wallet that should sign this envelope');
            return;
        }
        if (recipientFromQuery && address.toLowerCase() !== recipientFromQuery.toLowerCase()) {
            toast.error('Connected wallet does not match the recipient in the link');
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
                primaryType: 'EnvelopeSign',
                message: typed.message,
            });

            const resp = await api.post(`/api/envelopes/${envelopeId}/sign`, {
                recipientAddress: address,
                signature,
                signatureImageBase64: sigBase64 || undefined,
                placement: {
                    pageIndex: 0,
                    x: 50,
                    y: 50,
                    width: 180,
                    height: 70,
                },
            });

            toast.success('Signed successfully');
            // Reload envelope details
            const refreshed = await api.get(`/api/envelopes/${envelopeId}`);
            setEnvData(refreshed);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Signing failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold text-gradient mb-1">Sign Envelope</h1>
                        <p className="text-gray-400 break-all">Envelope ID: {envelopeId}</p>
                        {recipientFromQuery && (
                            <p className="text-gray-400 text-sm break-all">Recipient: {recipientFromQuery}</p>
                        )}
                    </div>
                    <Link href={`/envelopes/${envelopeId}`} className="text-gray-300 hover:text-white inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Link>
                </div>

                {!env ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">Loading…</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader title="Document" subtitle="Review the document before signing" />
                            <CardContent>
                                {docUrl ? (
                                    <a
                                        href={docUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="primary-button inline-flex items-center gap-2"
                                    >
                                        <FileText className="w-5 h-5" /> Open Document <ExternalLink className="w-5 h-5" />
                                    </a>
                                ) : (
                                    <p className="text-gray-400">Document not uploaded yet.</p>
                                )}

                                {myRecipient && (
                                    <p className="text-sm text-gray-400 mt-4">Your status: <span className="text-gray-200">{myRecipient.status}</span></p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Signature (optional)" subtitle="If you draw a signature, it will be stamped into the PDF" />
                            <CardContent>
                                <SignaturePad onChange={setSigBase64} />
                                <p className="text-xs text-gray-400 mt-2">
                                    Tip: You can sign without drawing. The wallet signature is the legal proof; the image is only visual.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Sign" subtitle="Signs EIP-712 typed data and submits to backend" />
                            <CardContent>
                                <button
                                    type="button"
                                    onClick={doSign}
                                    disabled={loading}
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
