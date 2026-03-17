'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSignature, ArrowRight, PlusCircle, FolderOpen, Clock } from 'lucide-react';

import Navbar from '../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../components/Card';
import { useAPI } from '../../hooks/useAPI';
import { useAuth } from '../../context/AuthContext';

function EnvelopeList({ title, subtitle, items, router, emptyText }) {
    return (
        <Card>
            <CardHeader title={title} subtitle={subtitle} />
            <CardContent>
                {items.length === 0 ? (
                    <p className="text-gray-400">{emptyText}</p>
                ) : (
                    <div className="space-y-3">
                        {items.map((env) => (
                            <button
                                key={`${env.role}-${env.envelopeId}`}
                                type="button"
                                onClick={() => router.push(`/envelopes/${env.envelopeId}`)}
                                className="w-full text-left rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div>
                                        <p className="font-medium text-gray-200">{env.metadata?.title || 'Untitled Envelope'}</p>
                                        <p className="text-xs text-gray-400 mt-1">Envelope ID: <span className="font-mono text-gray-200 break-all">{env.envelopeId}</span></p>
                                    </div>
                                    <div className="text-right text-xs text-gray-400">
                                        <p>{env.status}</p>
                                        <p>{env.role}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-4 flex-wrap text-xs text-gray-400">
                                    <p>Progress: {env.signerProgress?.signed || 0}/{env.signerProgress?.total || 0} signed</p>
                                    {env.nextAction && <p>{env.nextAction}</p>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function EnvelopesHome() {
    const router = useRouter();
    const api = useAPI();
    const { isAuthenticated } = useAuth();
    const [envelopeId, setEnvelopeId] = useState('');
    const [owned, setOwned] = useState([]);
    const [assigned, setAssigned] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setLoading(true);
                const resp = await api.get('/api/envelopes/mine');
                setOwned(resp.owned || []);
                setAssigned(resp.assigned || []);
            } catch (_) {
                setOwned([]);
                setAssigned([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [isAuthenticated]);

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gradient mb-2">Envelopes</h1>
                    <p className="text-gray-400">
                        Create, recover, and track your document-signing workflows. Every envelope keeps its `Envelope ID`, status, and signer progress here.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <Card>
                        <CardHeader
                            title="Create a new envelope"
                            subtitle="Upload a PDF, add recipients, and send it for signature"
                        />
                        <CardContent>
                            <Link
                                href="/envelopes/new"
                                className="primary-button inline-flex items-center gap-2"
                            >
                                <PlusCircle className="w-5 h-5" />
                                Create Envelope
                            </Link>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader
                            title="Open by Envelope ID"
                            subtitle="Paste an existing Envelope ID to jump straight to it"
                        />
                        <CardContent>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Envelope ID</label>
                                    <input
                                        value={envelopeId}
                                        onChange={(e) => setEnvelopeId(e.target.value)}
                                        placeholder="e.g. 2b7d... (UUID)"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => envelopeId && router.push(`/envelopes/${envelopeId}`)}
                                    disabled={!envelopeId}
                                    className="primary-button inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileSignature className="w-5 h-5" />
                                    Open
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {loading ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">
                            <Clock className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                            Loading your envelopes...
                        </CardContent>
                    </Card>
                ) : !isAuthenticated ? (
                    <Card>
                        <CardContent className="py-10 text-center text-gray-400">
                            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                            Sign in to recover your saved envelopes and drafts.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid lg:grid-cols-2 gap-6">
                        <EnvelopeList
                            title="Owned Envelopes"
                            subtitle="Drafts, sent envelopes, and completed signing flows you created"
                            items={owned}
                            router={router}
                            emptyText="No owned envelopes yet. Create one and it will stay listed here."
                        />
                        <EnvelopeList
                            title="Assigned To You"
                            subtitle="Envelopes where your linked wallet is a signer"
                            items={assigned}
                            router={router}
                            emptyText="No assigned envelopes yet."
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
