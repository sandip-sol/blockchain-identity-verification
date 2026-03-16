'use client';

import { useState } from 'react';
import { Search, CheckCircle, XCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent } from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import { useKYC } from '../../hooks/useKYC';

export default function VerifyPage() {
    const { isVerified, getIdentityToken } = useKYC();
    const [searchAddress, setSearchAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleVerify = async () => {
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

    const formatAddress = (address) => {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gradient mb-2">Verify Identity</h1>
                    <p className="text-gray-400">
                        Check if a wallet address has a verified KYC/KYB identity token
                    </p>
                </div>

                {/* Search Card */}
                <Card hover gradient>
                    <CardHeader
                        title="Enter Wallet Address"
                        subtitle="Enter an Ethereum address to check verification status"
                    />
                    <CardContent>
                        <div className="flex gap-4 mb-4">
                            <input
                                type="text"
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                                placeholder="0x..."
                                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                         focus:outline-none focus:border-primary-500 font-mono"
                            />
                            <button
                                onClick={handleVerify}
                                disabled={loading}
                                className="primary-button flex items-center gap-2 whitespace-nowrap"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Checking...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5" />
                                        Verify
                                    </>
                                )}
                            </button>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results */}
                {result && (
                    <div className="mt-6 animate-fade-in">
                        <Card>
                            <CardHeader title="Verification Result" />
                            <CardContent>
                                <div className="space-y-6">
                                    {/* Address */}
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2">
                                            Wallet Address
                                        </label>
                                        <code className="block px-4 py-3 bg-white/5 rounded-lg font-mono text-sm break-all">
                                            {result.address}
                                        </code>
                                    </div>

                                    {/* Status */}
                                    <div className="flex items-center justify-between p-6 rounded-lg border-2 
                                                  ${result.isVerified 
                                                      ? 'border-green-500/50 bg-green-500/10' 
                                                      : 'border-gray-600 bg-white/5'
                                                  }">
                                        <div className="flex items-center gap-4">
                                            {result.isVerified ? (
                                                <CheckCircle className="w-12 h-12 text-green-400" />
                                            ) : (
                                                <XCircle className="w-12 h-12 text-gray-400" />
                                            )}
                                            <div>
                                                <h3 className="text-xl font-bold mb-1">
                                                    {result.isVerified
                                                        ? 'Identity Verified ✓'
                                                        : 'Not Verified'
                                                    }
                                                </h3>
                                                <p className="text-sm text-gray-400">
                                                    {result.isVerified
                                                        ? 'This address has a valid, non-expired identity token'
                                                        : 'This address does not have a verified identity'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <StatusBadge
                                            status={result.isVerified ? 'verified' : 'none'}
                                            size="lg"
                                        />
                                    </div>

                                    {/* Information Box */}
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                                        <p className="text-sm text-blue-400">
                                            <strong>Note:</strong> This check only confirms on-chain verification status.
                                            For privacy, specific identity details are encrypted and stored off-chain.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Information */}
                {!result && (
                    <div className="mt-6">
                        <Card>
                            <CardHeader title="How It Works" />
                            <CardContent>
                                <div className="space-y-4 text-gray-400">
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-primary-400 font-bold">1</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-white mb-1">Enter Address</h4>
                                            <p className="text-sm">
                                                Paste the Ethereum wallet address you want to verify
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-primary-400 font-bold">2</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-white mb-1">Check Blockchain</h4>
                                            <p className="text-sm">
                                                We query the smart contract to check if the address has a valid identity token
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-primary-400 font-bold">3</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-white mb-1">View Results</h4>
                                            <p className="text-sm">
                                                Get instant confirmation of verification status without accessing private data
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
