'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Shield, Database, FileCheck, Lock } from 'lucide-react';

export default function Home() {
    const { isConnected } = useAccount();
    const router = useRouter();

    return (
        <div className="min-h-screen">
            {/* Navigation */}
            <nav className="glass-card m-4 p-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Shield className="w-8 h-8 text-primary-400" />
                        <h1 className="text-2xl font-bold text-gradient">KYC/KYB Platform</h1>
                    </div>
                    <ConnectButton />
                </div>
            </nav>

            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 py-20">
                <div className="text-center mb-16 animate-fade-in">
                    <h2 className="text-6xl font-bold mb-6 text-gradient">
                        Decentralized Identity Verification
                    </h2>
                    <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                        Secure, tamper-proof KYC/KYB platform on blockchain. Verify once, share selectively,
                        maintain complete control over your identity and transaction data.
                    </p>
                    {isConnected ? (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="primary-button text-lg px-8 py-4"
                        >
                            Go to Dashboard
                        </button>
                    ) : (
                        <div className="glass-card inline-block p-6">
                            <p className="text-gray-400 mb-4">Connect your wallet to get started</p>
                            <ConnectButton />
                        </div>
                    )}
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
                    <FeatureCard
                        icon={<Shield className="w-12 h-12" />}
                        title="Soulbound Identity"
                        description="Non-transferable NFTs representing verified identities"
                    />
                    <FeatureCard
                        icon={<Database className="w-12 h-12" />}
                        title="Off-Chain Storage"
                        description="Encrypted PII stored on IPFS, only hashes on-chain"
                    />
                    <FeatureCard
                        icon={<FileCheck className="w-12 h-12" />}
                        title="Transaction Proofs"
                        description="Tokenize and verify specific transactions securely"
                    />
                    <FeatureCard
                        icon={<Lock className="w-12 h-12" />}
                        title="Consent-Based Sharing"
                        description="Granular access control with EIP-712 signatures"
                    />
                </div>

                {/* Use Cases */}
                <div className="mt-32">
                    <h3 className="text-4xl font-bold text-center mb-12 text-gradient">
                        Use Cases
                    </h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        <UseCaseCard
                            title="Financial Services"
                            description="Banks and fintechs can verify customer identity without storing sensitive data"
                            benefits={['Reduced compliance costs', 'Faster onboarding', 'Enhanced privacy']}
                        />
                        <UseCaseCard
                            title="Cross-Border Transactions"
                            description="Reuse verified identity across jurisdictions and institutions"
                            benefits={['Interoperability', 'No redundant KYC', 'Global reach']}
                        />
                        <UseCaseCard
                            title="Regulatory Compliance"
                            description="Auditors can verify compliance without accessing raw PII"
                            benefits={['Audit trails', 'GDPR compliant', 'Selective disclosure']}
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-3 gap-8 mt-32">
                    <StatCard number="< $0.01" label="Avg Transaction Cost" />
                    <StatCard number="100%" label="Data Ownership" />
                    <StatCard number="Immutable" label="Audit Trail" />
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-32 py-8 border-t border-white/10">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-400">
                    <p>© 2026 KYC/KYB Blockchain Platform. Built on Polygon.</p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }) {
    return (
        <div className="glass-card p-6 card-hover animate-slide-up">
            <div className="text-primary-400 mb-4">{icon}</div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );
}

function UseCaseCard({ title, description, benefits }) {
    return (
        <div className="glass-card p-8 card-hover">
            <h4 className="text-2xl font-bold mb-4 text-gradient">{title}</h4>
            <p className="text-gray-300 mb-6">{description}</p>
            <ul className="space-y-2">
                {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-400">
                        <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
                        {benefit}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function StatCard({ number, label }) {
    return (
        <div className="glass-card p-8 text-center">
            <div className="text-4xl font-bold text-gradient mb-2">{number}</div>
            <div className="text-gray-400">{label}</div>
        </div>
    );
}
