'use client';

import { useRouter } from 'next/navigation';
import { Shield, Database, FileCheck, Lock, FileSignature, Activity, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
    const router = useRouter();
    const auth = useAuth();

    const handleGetStarted = () => {
        if (auth.isAuthenticated) {
            router.push('/dashboard');
        } else {
            router.push('/login?mode=signup');
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[100px]"></div>
            </div>

            <div className="relative z-10">
                {/* Navigation */}
                <nav className="glass-card m-4 p-4">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <Shield className="w-8 h-8 text-primary-400" />
                            <h1 className="text-2xl font-bold text-gradient">KYC/KYB Platform</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            {auth.isAuthenticated ? (
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="primary-button"
                                >
                                    Dashboard
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => router.push('/login')}
                                        className="glass-button text-sm"
                                    >
                                        Login
                                    </button>
                                    <button
                                        onClick={() => router.push('/login?mode=signup')}
                                        className="primary-button text-sm"
                                    >
                                        Sign Up
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="max-w-7xl mx-auto px-4 py-20">
                    <div className="text-center mb-16 animate-fade-in relative">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md animate-slide-up">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            <span className="text-sm font-medium text-gray-300">Live on Polygon</span>
                        </div>
                        <h2 className="text-5xl md:text-7xl font-bold mb-8 text-gradient tracking-tight leading-tight">
                            Decentralized Identity <br /> Verification
                        </h2>
                        <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                            Secure, tamper-proof KYC/KYB platform on blockchain. Verify once, share selectively,
                            maintain complete control over your identity and transaction data.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={handleGetStarted}
                                className="primary-button text-lg px-8 py-4 inline-flex items-center gap-2 group"
                            >
                                Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => router.push('/docs')}
                                className="glass-button text-lg px-8 py-4 inline-flex items-center gap-2"
                            >
                                View Documentation
                            </button>
                        </div>
                    </div>

                    {/* Core Features Overview */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
                        <FeatureCard
                            icon={<Shield className="w-12 h-12" />}
                            title="Soulbound Identity"
                            description="Non-transferable NFTs representing verified identities"
                            delay="0"
                        />
                        <FeatureCard
                            icon={<Database className="w-12 h-12" />}
                            title="Off-Chain Storage"
                            description="Encrypted PII stored on IPFS, only hashes on-chain"
                            delay="100"
                        />
                        <FeatureCard
                            icon={<FileCheck className="w-12 h-12" />}
                            title="Transaction Proofs"
                            description="Tokenize and verify specific transactions securely"
                            delay="200"
                        />
                        <FeatureCard
                            icon={<Lock className="w-12 h-12" />}
                            title="Consent-Based Sharing"
                            description="Granular access control with EIP-712 signatures"
                            delay="300"
                        />
                    </div>
                </div>

                {/* KYC/KYB Section */}
                <section className="py-20 bg-gradient-to-b from-transparent to-purple-900/10">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div className="order-2 lg:order-1">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6">
                                    <Shield className="w-5 h-5 text-primary-400" />
                                    <span className="text-primary-300 font-medium">KYC / KYB Verification</span>
                                </div>
                                <h3 className="text-4xl font-bold mb-6 text-gradient">
                                    Verify Once, Use Everywhere
                                </h3>
                                <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                                    Get your identity verified and receive a soulbound NFT (DID) that proves your verification status
                                    without exposing sensitive personal information. Share selectively with businesses and institutions.
                                </p>
                                <ul className="space-y-4">
                                    <BenefitItem text="Soulbound tokens cannot be transferred or sold" />
                                    <BenefitItem text="Personal data encrypted and stored off-chain" />
                                    <BenefitItem text="GDPR compliant selective disclosure" />
                                    <BenefitItem text="Immutable audit trail on blockchain" />
                                </ul>
                            </div>
                            <div className="glass-card p-8 lg:order-2 transform hover:scale-[1.02] transition-transform duration-500">
                                <div className="space-y-6">
                                    <StepItem number="1" title="Submit Documents" description="Upload ID, proof of address, and selfie" />
                                    <StepItem number="2" title="Verification" description="Documents verified by authorized verifiers" />
                                    <StepItem number="3" title="Receive DID" description="Soulbound identity token minted to your wallet" />
                                    <StepItem number="4" title="Share Selectively" description="Grant access to specific verifiers as needed" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* DocuSign Section */}
                <section className="py-20">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div className="order-2 lg:order-1 glass-card p-8 transform hover:scale-[1.02] transition-transform duration-500">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <FileSignature className="w-8 h-8 text-secondary-400" />
                                        <div>
                                            <p className="font-medium text-white">Create Envelope</p>
                                            <p className="text-sm text-gray-400">Upload document, add signers</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <Activity className="w-8 h-8 text-yellow-400" />
                                        <div>
                                            <p className="font-medium text-white">Track Progress</p>
                                            <p className="text-sm text-gray-400">Real-time signer status</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                        <div>
                                            <p className="font-medium text-white">Blockchain Anchor</p>
                                            <p className="text-sm text-gray-400">Immutable proof of completion</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="order-1 lg:order-2">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary-500/10 border border-secondary-500/20 mb-6">
                                    <FileSignature className="w-5 h-5 text-secondary-400" />
                                    <span className="text-secondary-300 font-medium">Document Signing</span>
                                </div>
                                <h3 className="text-4xl font-bold mb-6 text-gradient">
                                    DocuSign-like Experience, On-Chain
                                </h3>
                                <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                                    Create envelopes, invite signers, and get cryptographic signatures anchored to the blockchain.
                                    Every signature is verifiable and tamper-proof forever.
                                </p>
                                <ul className="space-y-4">
                                    <BenefitItem text="Create multi-signer document envelopes" />
                                    <BenefitItem text="EIP-712 typed data signatures" />
                                    <BenefitItem text="Completion proof anchored on-chain" />
                                    <BenefitItem text="Download signed PDFs with embedded proofs" />
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Transaction Proofs Section */}
                <section className="py-20 bg-gradient-to-b from-transparent to-slate-900/50">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                                <Activity className="w-5 h-5 text-green-400" />
                                <span className="text-green-300 font-medium">Transaction Proofs</span>
                            </div>
                            <h3 className="text-4xl font-bold mb-6 text-gradient">
                                Tokenize Any Transaction
                            </h3>
                            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                                Register transaction hashes on-chain and get verifiable proofs. Perfect for compliance,
                                audit trails, and proving transaction history to third parties.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="glass-card p-8 text-center hover:bg-white/10 transition-colors">
                                <div className="text-4xl font-bold text-gradient mb-2">&lt; $0.01</div>
                                <div className="text-gray-400 font-medium">Avg Transaction Cost</div>
                            </div>
                            <div className="glass-card p-8 text-center hover:bg-white/10 transition-colors">
                                <div className="text-4xl font-bold text-gradient mb-2">100%</div>
                                <div className="text-gray-400 font-medium">Data Ownership</div>
                            </div>
                            <div className="glass-card p-8 text-center hover:bg-white/10 transition-colors">
                                <div className="text-4xl font-bold text-gradient mb-2">Immutable</div>
                                <div className="text-gray-400 font-medium">Audit Trail</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Use Cases */}
                <section className="py-20">
                    <div className="max-w-7xl mx-auto px-4">
                        <h3 className="text-4xl font-bold text-center mb-16 text-gradient">
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
                </section>

                {/* CTA Section */}
                <section className="py-20">
                    <div className="max-w-4xl mx-auto px-4 text-center">
                        <div className="glass-card p-12 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <h3 className="text-4xl font-bold mb-6 text-gradient relative z-10">Ready to Get Started?</h3>
                            <p className="text-gray-300 mb-8 text-lg relative z-10">
                                Connect your wallet and experience decentralized identity verification today.
                            </p>
                            <button
                                onClick={handleGetStarted}
                                className="primary-button text-lg px-8 py-4 inline-flex items-center gap-2 relative z-10"
                            >
                                {auth.isAuthenticated ? 'Go to Dashboard' : 'Get Started'} <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="py-8 border-t border-white/10">
                    <div className="max-w-7xl mx-auto px-4 text-center text-gray-400">
                        <p>© 2026 KYC/KYB Blockchain Platform. Built on Polygon.</p>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }) {
    return (
        <div
            className="glass-card p-6 card-hover animate-slide-up"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="text-primary-400 mb-4">{icon}</div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );
}

function BenefitItem({ text }) {
    return (
        <li className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span className="text-gray-300">{text}</span>
        </li>
    );
}

function StepItem({ number, title, description }) {
    return (
        <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-500/30 border border-primary-500/50 flex items-center justify-center text-primary-300 font-bold flex-shrink-0">
                {number}
            </div>
            <div>
                <p className="font-medium text-white">{title}</p>
                <p className="text-sm text-gray-400">{description}</p>
            </div>
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
