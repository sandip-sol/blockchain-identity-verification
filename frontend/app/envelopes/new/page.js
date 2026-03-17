'use client';

import { useMemo, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileUp, Users, Send, ArrowLeft, ArrowRight, FileSignature } from 'lucide-react';

import Navbar from '../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../components/Card';
import { useAPI } from '../../../hooks/useAPI';
import { useAuth } from '../../../context/AuthContext';

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function NewEnvelopePage() {
    const router = useRouter();
    const api = useAPI();
    const { isAuthenticated } = useAuth();
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [envelope, setEnvelope] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const [pdfFile, setPdfFile] = useState(null);
    const [recipientsText, setRecipientsText] = useState('');

    const recipients = useMemo(() => {
        return recipientsText
            .split(/\s|,|\n/)
            .map((x) => x.trim())
            .filter(Boolean);
    }, [recipientsText]);

    const createDraft = async () => {
        if (!isConnected || !address) {
            toast.error('Connect your wallet first');
            return;
        }
        if (!isAuthenticated) {
            toast.error('Sign in before creating an envelope');
            return;
        }
        setLoading(true);
        try {
            const resp = await api.post('/api/envelopes/draft', {
                ownerAddress: address,
                title,
                description,
            });
            setEnvelope(resp.envelope);
            toast.success('Draft created');
            setStep(2);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to create draft');
        } finally {
            setLoading(false);
        }
    };

    const uploadPdf = async () => {
        if (!envelope?.envelopeId) return;
        if (!pdfFile) {
            toast.error('Select a PDF first');
            return;
        }
        setLoading(true);
        try {
            const pdfBase64 = await fileToBase64(pdfFile);
            const message = `Create Envelope ${envelope.envelopeId} for ${address}`;
            const signature = await signMessageAsync({ message });

            const resp = await api.post('/api/envelopes/upload', {
                envelopeId: envelope.envelopeId,
                ownerAddress: address,
                signature,
                pdfBase64,
            });
            setEnvelope(resp.envelope);
            toast.success('PDF uploaded');
            setStep(3);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to upload PDF');
        } finally {
            setLoading(false);
        }
    };

    const addRecipients = async () => {
        if (!envelope?.envelopeId) return;
        if (!recipients.length) {
            toast.error('Add at least one recipient wallet address');
            return;
        }
        setLoading(true);
        try {
            const message = `Manage Envelope ${envelope.envelopeId} as owner ${address}`;
            const signature = await signMessageAsync({ message });

            const resp = await api.post('/api/envelopes/recipients', {
                envelopeId: envelope.envelopeId,
                ownerAddress: address,
                signature,
                recipients: recipients.map((r, idx) => ({ recipientAddress: r, signingOrder: idx + 1 })),
            });
            setEnvelope(resp.envelope);
            toast.success('Recipients added');
            setStep(4);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to add recipients');
        } finally {
            setLoading(false);
        }
    };

    const sendEnvelope = async () => {
        if (!envelope?.envelopeId) return;
        setLoading(true);
        try {
            const message = `Send Envelope ${envelope.envelopeId} by owner ${address}`;
            const signature = await signMessageAsync({ message });

            const resp = await api.post('/api/envelopes/send', {
                envelopeId: envelope.envelopeId,
                ownerAddress: address,
                signature,
            });
            setEnvelope(resp.envelope);
            toast.success('Envelope sent');
            router.push(`/envelopes/${envelope.envelopeId}`);
        } catch (e) {
            toast.error(e?.response?.data?.error || e.message || 'Failed to send envelope');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gradient mb-1">Create Envelope</h1>
                        <p className="text-gray-400">MVP flow: Draft → Upload PDF → Add recipients → Send</p>
                    </div>
                    <Link href="/envelopes" className="text-gray-300 hover:text-white inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Link>
                </div>

                {!isConnected ? (
                    <Card>
                        <CardContent className="py-10 text-center">
                            <FileSignature className="w-14 h-14 mx-auto mb-4 text-gray-600" />
                            <h2 className="text-xl font-bold mb-2">Connect Wallet Required</h2>
                            <p className="text-gray-400">Connect your wallet to create and manage envelopes.</p>
                        </CardContent>
                    </Card>
                ) : !isAuthenticated ? (
                    <Card>
                        <CardContent className="py-10 text-center">
                            <FileSignature className="w-14 h-14 mx-auto mb-4 text-gray-600" />
                            <h2 className="text-xl font-bold mb-2">Sign In Required</h2>
                            <p className="text-gray-400">Use your account login and linked wallet to create production envelopes.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader title={`Step ${step} of 4`} subtitle={envelope?.envelopeId ? `Envelope ID: ${envelope.envelopeId}` : 'Create a new draft envelope'} />
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Title (optional)</label>
                                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Offer Letter" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Description (optional)</label>
                                        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary-500" />
                                    </div>
                                </div>

                                <div className="mt-5 flex items-center gap-3">
                                    <button type="button" onClick={createDraft} disabled={loading || step !== 1} className="primary-button inline-flex items-center gap-2 disabled:opacity-50">
                                        <ArrowRight className="w-5 h-5" /> Create Draft
                                    </button>
                                    {envelope?.envelopeId && (
                                        <button type="button" onClick={() => router.push(`/envelopes/${envelope.envelopeId}`)} className="secondary-button">
                                            View
                                        </button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Upload PDF" subtitle="Owner signs a message to authorize the upload" />
                            <CardContent>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-gray-200 hover:file:bg-white/15"
                                />
                                <div className="mt-4">
                                    <button type="button" onClick={uploadPdf} disabled={loading || step !== 2} className="primary-button inline-flex items-center gap-2 disabled:opacity-50">
                                        <FileUp className="w-5 h-5" /> Upload PDF
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Add Recipients" subtitle="Paste wallet addresses (comma / space / new line separated)" />
                            <CardContent>
                                <textarea
                                    value={recipientsText}
                                    onChange={(e) => setRecipientsText(e.target.value)}
                                    placeholder={`0xabc...\n0xdef...`}
                                    rows={5}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary-500"
                                />
                                <div className="mt-4 flex items-center justify-between gap-4">
                                    <p className="text-sm text-gray-400">Recipients parsed: <span className="text-gray-200">{recipients.length}</span></p>
                                    <button type="button" onClick={addRecipients} disabled={loading || step !== 3} className="primary-button inline-flex items-center gap-2 disabled:opacity-50">
                                        <Users className="w-5 h-5" /> Add Recipients
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Send" subtitle="Locks the envelope and marks it as SENT" />
                            <CardContent>
                                <button type="button" onClick={sendEnvelope} disabled={loading || step !== 4} className="primary-button inline-flex items-center gap-2 disabled:opacity-50">
                                    <Send className="w-5 h-5" /> Send Envelope
                                </button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
