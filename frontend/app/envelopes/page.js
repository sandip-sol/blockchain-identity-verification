'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSignature, ArrowRight, PlusCircle } from 'lucide-react';

import Navbar from '../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../components/Card';

export default function EnvelopesHome() {
    const router = useRouter();
    const [envelopeId, setEnvelopeId] = useState('');

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gradient mb-2">Envelopes</h1>
                    <p className="text-gray-400">
                        DocuSign-like signing workflow: create an envelope, add recipients, send, and collect wallet-based signatures.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
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
                            title="Open an existing envelope"
                            subtitle="Paste an envelopeId to view status or sign"
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
            </div>
        </div>
    );
}
