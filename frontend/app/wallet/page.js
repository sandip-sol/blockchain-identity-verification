'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Wallet, Plus, FileText } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent } from '../../components/Card';
import TransactionTable from '../../components/TransactionTable';
import { useAPI } from '../../hooks/useAPI';

export default function WalletPage() {
    const { address, isConnected } = useAccount();
    const router = useRouter();
    const api = useAPI();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isConnected || !address) return;

        const fetchTransactions = async () => {
            setLoading(true);
            try {
                const data = await api.get(`/api/transaction/history/${address}`);
                const txList = (data.transactions || []).map((tx) => ({
                    type: tx.txType || 'Unknown',
                    hash: tx.blockchainTxHash || tx.txHash || '',
                    status: tx.blockchainTxHash ? 'verified' : 'pending',
                    timestamp: tx.timestamp || new Date().toISOString(),
                }));
                setTransactions(txList);
            } catch (err) {
                // User may not have any transactions yet — that's fine
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [isConnected, address]);

    if (!isConnected) {
        return (
            <div className="min-h-screen">
                <Navbar />
                <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                    <Card>
                        <CardContent>
                            <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                            <h2 className="text-2xl font-bold mb-4">Connect Wallet Required</h2>
                            <p className="text-gray-400">
                                Please connect your wallet to view transaction proofs
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-gradient mb-2">Transaction Proofs</h1>
                        <p className="text-gray-400">
                            Create and manage tokenized transaction proofs for selective disclosure
                        </p>
                    </div>
                    <button
                        className="primary-button flex items-center gap-2"
                        onClick={() => {/* Handle create transaction proof */ }}
                    >
                        <Plus className="w-5 h-5" />
                        Create Proof
                    </button>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader
                                title="Your Transaction History"
                                subtitle="All blockchain transactions related to your identity"
                            />
                            <CardContent className="p-0">
                                <TransactionTable transactions={transactions} loading={loading} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Stats */}
                        <Card>
                            <CardHeader title="Statistics" />
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">Total Proofs</p>
                                        <p className="text-3xl font-bold text-gradient">
                                            {transactions.length}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400 mb-1">Active Shares</p>
                                        <p className="text-3xl font-bold text-gradient">0</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info */}
                        <Card>
                            <CardHeader title="About Transaction Proofs" />
                            <CardContent>
                                <div className="space-y-3 text-sm text-gray-400">
                                    <p>
                                        Transaction proofs allow you to create verifiable tokens for specific transactions.
                                    </p>
                                    <p>
                                        Share these proofs with third parties without revealing unnecessary details.
                                    </p>
                                    <p>
                                        All proofs are cryptographically signed and immutable.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
