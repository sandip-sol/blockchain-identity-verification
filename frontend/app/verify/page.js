'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, CheckCircle, XCircle, Upload, ExternalLink, ShieldCheck, FileWarning } from 'lucide-react';

import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent } from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import { useKYC } from '../../hooks/useKYC';
import { useAPI } from '../../hooks/useAPI';
import { formatTimestamp, statusToBadge } from '../../utils/proof';

export default function VerifyPage() {
    const searchParams = useSearchParams();
    const envelopeIdFromQuery = searchParams?.get('envelopeId') || '';
    const { isVerified } = useKYC();
    const api = useAPI();

    const [searchAddress, setSearchAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const [envelopeId, setEnvelopeId] = useState(envelopeIdFromQuery);
    const [docLoading, setDocLoading] = useState(false);
    const [docResult, setDocResult] = useState(null);
    const [docError, setDocError] = useState(null);

    useEffect(() => {
        setEnvelopeId(envelopeIdFromQuery);
        if (!envelopeIdFromQuery) return;
        loadVerification(envelopeIdFromQuery);
    }, [envelopeIdFromQuery]);

    const handleVerifyIdentity = async () => {
        if (!searchAddress || searchAddress.length !== 42) {
            setError('Please enter a valid Ethereum address');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const verified = await isVerified(searchAddress);
            setResult({
                address: searchAddress,
                isVerified: verified,
            });
        } catch (err) {
            console.error('Verification error:', err);
            setError('Failed to verify address. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const loadVerification = async (id) => {
        if (!id?.trim()) {
            setDocError('Enter an agreement ID to verify a signed document');
            return;
        }

        setDocLoading(true);
        setDocError(null);

        try {
            const response = await api.get(`/api/public/envelopes/${encodeURIComponent(id.trim())}/verify`);
            setDocResult(response);
        } catch (err) {
            setDocResult(null);
            setDocError(err?.response?.data?.error || err.message || 'Failed to load document proof');
        } finally {
            setDocLoading(false);
        }
    };

    const handleVerifyDocument = async () => {
        await loadVerification(envelopeId);
    };

    const handlePdfUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !envelopeId?.trim()) {
            setDocError('Load an agreement first, then upload the signed PDF to verify it');
            return;
        }

        setDocLoading(true);
        setDocError(null);
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = String(reader.result || '');
                    resolve(result.includes(',') ? result.split(',')[1] : result);
                };
                reader.onerror = () => reject(reader.error || new Error('Failed to read PDF'));
                reader.readAsDataURL(file);
            });
            const response = await api.post(`/api/public/envelopes/${encodeURIComponent(envelopeId.trim())}/verify`, {
                pdfBase64: base64,
            });
            setDocResult(response);
        } catch (err) {
            setDocError(err?.response?.data?.error || err.message || 'Failed to verify uploaded PDF');
        } finally {
            setDocLoading(false);
            event.target.value = '';
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div className="mb-2">
                    <h1 className="text-4xl font-bold text-gradient mb-2">Verification Center</h1>
                    <p className="text-gray-400">
                        Verify identity tokens or inspect a blockchain-backed proof of signature.
                    </p>
                </div>

                <Card hover gradient>
                    <CardHeader
                        title="Proof of Signature"
                        subtitle="Open a proof URL, enter an agreement ID, or upload the final PDF to detect tampering."
                    />
                    <CardContent>
                        <div className="flex gap-4 mb-4 flex-col md:flex-row">
                            <input
                                type="text"
                                value={envelopeId}
                                onChange={(e) => setEnvelopeId(e.target.value)}
                                placeholder="Agreement / envelope ID"
                                className="input-field flex-1 font-mono"
                            />
                            <button
                                onClick={handleVerifyDocument}
                                disabled={docLoading}
                                className="primary-button flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {docLoading ? 'Checking...' : <><Search className="w-5 h-5" /> Verify Document</>}
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <label className="secondary-button inline-flex items-center gap-2 cursor-pointer">
                                <Upload className="w-4 h-4" />
                                Upload Signed PDF
                                <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
                            </label>
                            <p className="text-xs text-gray-400">
                                Uploading the final PDF recomputes its hash and fails verification if the file was altered.
                            </p>
                        </div>

                        {docError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-lg text-red-300 text-sm mt-4">
                                {docError}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {docResult && (
                    <div className="grid lg:grid-cols-[1.25fr_0.9fr] gap-6">
                        <Card>
                            <CardHeader title="Document Verification Result" />
                            <CardContent>
                                <div className={`flex items-center justify-between p-5 rounded-xl border ${docResult.success ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
                                    <div className="flex items-center gap-4">
                                        {docResult.success ? (
                                            <CheckCircle className="w-12 h-12 text-green-400" />
                                        ) : (
                                            <FileWarning className="w-12 h-12 text-red-300" />
                                        )}
                                        <div>
                                            <h3 className="text-xl font-bold text-white">
                                                {docResult.success ? 'Authentic signature proof confirmed' : 'Verification failed'}
                                            </h3>
                                            <p className="text-sm text-gray-300 mt-1">
                                                {docResult.success
                                                    ? 'The agreement status, signer set, on-chain record, and PDF integrity all line up.'
                                                    : 'One or more proof checks failed. Review the detailed checks below.'}
                                            </p>
                                        </div>
                                    </div>
                                    <StatusBadge status={statusToBadge(docResult)} size="lg" />
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 mt-5 text-sm">
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Signer</p>
                                        <p className="mt-1 text-white break-all">{docResult.proof?.signer || '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Signed timestamp</p>
                                        <p className="mt-1 text-white">{formatTimestamp(docResult.proof?.signedTimestamp)}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Document hash</p>
                                        <p className="mt-1 text-white break-all">{docResult.proof?.documentHash || '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Final PDF hash</p>
                                        <p className="mt-1 text-white break-all">{docResult.proof?.finalPdfHash || '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Transaction hash</p>
                                        <p className="mt-1 text-white break-all">{docResult.proof?.transactionHash || '-'}</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                        <p className="text-gray-400">Network / status</p>
                                        <p className="mt-1 text-white">{docResult.proof?.network || '-'} · {docResult.proof?.finalStatus || '-'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Verification Checks" />
                            <CardContent>
                                <div className="space-y-3">
                                    {[
                                        ['Uploaded PDF hash matches stored final hash', docResult.checks?.uploadedFinalPdfHashMatches],
                                        ['Canonical hash matches blockchain anchor', docResult.checks?.canonicalHashMatchesAnchor],
                                        ['Signer address matches recorded signer set', docResult.checks?.signerAddressMatchesRecordedSigner],
                                        ['Anchor transaction exists', docResult.checks?.txHashExists],
                                        ['Agreement is finalized', docResult.checks?.agreementStatusFinalized],
                                    ].map(([label, passed]) => (
                                        <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4">
                                            <p className="text-sm text-gray-200">{label}</p>
                                            <StatusBadge
                                                status={passed === true ? 'verified' : passed === false ? 'rejected' : 'pending'}
                                                size="sm"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm space-y-2">
                                    <p className="text-gray-400">Agreement ID</p>
                                    <p className="text-white break-all">{docResult.proof?.agreementId || '-'}</p>
                                    {docResult.proof?.explorerUrl && (
                                        <Link href={docResult.proof.explorerUrl} target="_blank" className="text-primary-300 hover:text-primary-200 inline-flex items-center gap-2">
                                            <ExternalLink className="w-4 h-4" /> View on explorer
                                        </Link>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card>
                    <CardHeader
                        title="Identity Verification"
                        subtitle="The existing wallet identity check remains available here."
                    />
                    <CardContent>
                        <div className="flex gap-4 mb-4 flex-col md:flex-row">
                            <input
                                type="text"
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                                placeholder="0x..."
                                className="input-field flex-1 font-mono"
                            />
                            <button
                                onClick={handleVerifyIdentity}
                                disabled={loading}
                                className="primary-button flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {loading ? 'Checking...' : <><ShieldCheck className="w-5 h-5" /> Verify Identity</>}
                            </button>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {result && (
                            <div className={`flex items-center justify-between p-6 rounded-lg border-2 ${result.isVerified ? 'border-green-500/50 bg-green-500/10' : 'border-gray-600 bg-white/5'}`}>
                                <div className="flex items-center gap-4">
                                    {result.isVerified ? (
                                        <CheckCircle className="w-12 h-12 text-green-400" />
                                    ) : (
                                        <XCircle className="w-12 h-12 text-gray-400" />
                                    )}
                                    <div>
                                        <h3 className="text-xl font-bold mb-1 text-white">
                                            {result.isVerified ? 'Identity Verified' : 'Not Verified'}
                                        </h3>
                                        <p className="text-sm text-gray-400 break-all">{result.address}</p>
                                    </div>
                                </div>
                                <StatusBadge status={result.isVerified ? 'verified' : 'none'} size="lg" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
