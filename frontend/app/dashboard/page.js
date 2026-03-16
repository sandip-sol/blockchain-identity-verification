'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Shield, FileCheck, Wallet, AlertCircle, ExternalLink, FileSignature, Activity } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent, CardFooter } from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
// TransactionTable removed; dashboard now shows consolidated activity feed (tx hashes + signing proofs)
import { useKYC } from '../../hooks/useKYC';
import { useAPI } from '../../hooks/useAPI';

export default function Dashboard() {
    const { address, isConnected } = useAccount();
    const router = useRouter();
    const { getIdentityToken, checkStatus, isVerified } = useKYC();
    const api = useAPI();

    const [identityToken, setIdentityToken] = useState(null);
    const [userStatus, setUserStatus] = useState(null);
    const [verified, setVerified] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activities, setActivities] = useState([]);
    const [txProofCount, setTxProofCount] = useState(0);

    useEffect(() => {
        if (!isConnected) {
            setLoading(false);
            return;
        }

        loadData();
    }, [isConnected, address]);

    const loadData = async () => {
        setLoading(true);

        try {
            // Parallelize all API calls for faster loading
            const [token, status, isVerifiedOnChain] = await Promise.all([
                getIdentityToken(),
                checkStatus(),
                isVerified()
            ]);

            setIdentityToken(token);
            setUserStatus(status);
            setVerified(isVerifiedOnChain);

            // Load activity and transaction count in parallel
            if (address) {
                const [activityResp, histResp] = await Promise.allSettled([
                    api.get(`/api/activity/${address}`),
                    api.get(`/api/transaction/history/${address}`)
                ]);

                if (activityResp.status === 'fulfilled') {
                    setActivities((activityResp.value.activities || []).slice(0, 8));
                }
                if (histResp.status === 'fulfilled') {
                    setTxProofCount(Array.isArray(histResp.value.transactions) ? histResp.value.transactions.length : 0);
                }
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen">
                <Navbar />
                <div className="max-w-3xl mx-auto px-4 py-20">
                    <Card>
                        <CardHeader title="Connect your wallet" icon={<Wallet className="w-6 h-6" />} />
                        <CardContent>
                            <p className="text-gray-300">
                                You’re logged in. Now connect a wallet to use blockchain features like KYC minting, transaction proofs, and document signing.
                            </p>
                            <div className="mt-6">
                                <div className="glass-card inline-block p-4">
                                    <p className="text-gray-400 text-sm mb-2">Wallet</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-200 text-sm">Not connected</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getDaysUntilExpiry = () => {
        if (!identityToken?.expiryDate) return null;
        const days = Math.ceil((identityToken.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        return days;
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gradient mb-2">Dashboard</h1>
                    <p className="text-gray-400">
                        Welcome back! View your identity status and manage your verification.
                    </p>
                </div>

                {loading ? (
                    <div className="glass-card p-12 text-center">
                        <div className="animate-pulse">
                            <Shield className="w-16 h-16 mx-auto mb-4 text-primary-400" />
                            <p className="text-gray-400">Loading your data...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Identity Status Card */}
                            <Card hover gradient>
                                <CardHeader
                                    title="Identity Verification Status"
                                    subtitle={`Wallet: ${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`}
                                />
                                <CardContent>
                                    {identityToken ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Status</span>
                                                <StatusBadge
                                                    status={identityToken.isRevoked ? 'revoked' : (verified ? 'verified' : 'expired')}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Token ID</span>
                                                <span className="font-mono">#{identityToken.tokenId}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Type</span>
                                                <span className="font-medium">{identityToken.verificationType}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Verified On</span>
                                                <span>{formatDate(identityToken.verifiedAt)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400">Expires On</span>
                                                <span>{formatDate(identityToken.expiryDate)}</span>
                                            </div>

                                            {getDaysUntilExpiry() !== null && getDaysUntilExpiry() < 30 && (
                                                <div className="p-4 bg-orange-500/10 border border-orange-500/50 rounded-lg flex items-start gap-3">
                                                    <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-orange-400 font-medium">Renewal Recommended</p>
                                                        <p className="text-sm text-gray-400 mt-1">
                                                            Your verification expires in {getDaysUntilExpiry()} days
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <Shield className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                            <p className="text-gray-400 mb-6">You don't have an identity token yet</p>
                                            <button
                                                onClick={() => router.push('/kyc')}
                                                className="primary-button"
                                            >
                                                Get Verified
                                            </button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Recent Activity */}
                            <Card>
                                <CardHeader
                                    title="Recent Activity"
                                    subtitle="Tx hashes, envelope anchors, and signing proofs"
                                />
                                <CardContent>
                                    {activities.length === 0 ? (
                                        <div className="text-gray-400">No activity yet. Try submitting KYC or creating an envelope.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {activities.map((a, idx) => (
                                                <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                                        <p className="text-sm font-medium text-gray-200">{a.type}</p>
                                                        <p className="text-xs text-gray-400">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
                                                    </div>
                                                    {a.txHash && <p className="text-xs text-gray-400 mt-1 break-all">Tx: <span className="font-mono text-gray-200">{a.txHash}</span></p>}
                                                    {a.envelopeId && <p className="text-xs text-gray-400 mt-1 break-all">Envelope: <span className="font-mono text-gray-200">{a.envelopeId}</span></p>}
                                                    {a.payloadHash && <p className="text-xs text-gray-400 mt-1 break-all">Payload Hash: <span className="font-mono text-gray-200">{a.payloadHash}</span></p>}
                                                    {a.identityTokenId && <p className="text-xs text-gray-400 mt-1">DID: <span className="font-mono text-gray-200">{a.identityTokenId}</span></p>}
                                                </div>
                                            ))}
                                            <button onClick={() => router.push('/activity')} className="secondary-button w-full">View full activity</button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Quick Actions */}
                            <Card>
                                <CardHeader title="Quick Actions" />
                                <CardContent>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => router.push('/kyc')}
                                            className="w-full flex items-center gap-3 p-4 bg-primary-500/10 hover:bg-primary-500/20 
                                                     border border-primary-500/50 rounded-lg transition-all group"
                                        >
                                            <FileCheck className="w-5 h-5 text-primary-400 group-hover:scale-110 transition-transform" />
                                            <div className="text-left">
                                                <p className="font-medium">Submit KYC</p>
                                                <p className="text-xs text-gray-400">Get verified</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => router.push('/wallet')}
                                            className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 
                                                     border border-white/10 rounded-lg transition-all group"
                                        >
                                            <Activity className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                                            <div className="text-left">
                                                <p className="font-medium">Transaction Proofs</p>
                                                <p className="text-xs text-gray-400">Manage proofs</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => router.push('/envelopes')}
                                            className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 
                                                     border border-white/10 rounded-lg transition-all group"
                                        >
                                            <FileSignature className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                                            <div className="text-left">
                                                <p className="font-medium">Document Signing</p>
                                                <p className="text-xs text-gray-400">Create and track envelopes</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => router.push('/activity')}
                                            className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 
                                                     border border-white/10 rounded-lg transition-all group"
                                        >
                                            <Activity className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                                            <div className="text-left">
                                                <p className="font-medium">Activity</p>
                                                <p className="text-xs text-gray-400">View tx hashes and proofs</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => router.push('/verify')}
                                            className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 
                                                     border border-white/10 rounded-lg transition-all group"
                                        >
                                            <Shield className="w-5 h-5 text-gray-400 group-hover:scale-110 transition-transform" />
                                            <div className="text-left">
                                                <p className="font-medium">Verify Others</p>
                                                <p className="text-xs text-gray-400">Check identity</p>
                                            </div>
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Stats */}
                            <Card>
                                <CardHeader title="Your Stats" />
                                <CardContent>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-400 mb-1">Verification Type</p>
                                            <p className="text-2xl font-bold text-gradient">
                                                {identityToken?.verificationType || 'None'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400 mb-1">Transaction Proofs</p>
                                            <p className="text-2xl font-bold text-gradient">
                                                {txProofCount}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400 mb-1">On-Chain Status</p>
                                            <p className="text-2xl font-bold text-gradient">
                                                {verified ? 'Active' : 'Inactive'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
