'use client';

import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Book, FileText, Code, HelpCircle } from 'lucide-react';

export default function DocsPage() {
    const router = useRouter();

    const sections = [
        {
            title: 'Getting Started',
            icon: <Book className="w-6 h-6" />,
            items: [
                { label: 'Create an Account', description: 'Sign up with your email and password' },
                { label: 'Submit KYC', description: 'Complete identity verification' },
                { label: 'Connect Wallet', description: 'Link your Web3 wallet for blockchain operations' },
            ]
        },
        {
            title: 'Features',
            icon: <FileText className="w-6 h-6" />,
            items: [
                { label: 'Soulbound Identity', description: 'Non-transferable NFT representing your verified identity' },
                { label: 'Selective Disclosure', description: 'Share only the information you choose' },
                { label: 'Transaction Proofs', description: 'Create verifiable proofs of transactions' },
            ]
        },
        {
            title: 'For Developers',
            icon: <Code className="w-6 h-6" />,
            items: [
                { label: 'API Documentation', description: 'RESTful API for integration', link: '/docs/api' },
                { label: 'Smart Contracts', description: 'On-chain identity verification contracts' },
                { label: 'Webhook Events', description: 'Real-time notifications for status changes' },
            ]
        },
    ];

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
                        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => router.push('/')}>
                            <Shield className="w-8 h-8 text-primary-400 group-hover:scale-110 transition-transform duration-300" />
                            <h1 className="text-2xl font-bold text-gradient">KYC/KYB Platform</h1>
                        </div>
                        <button
                            onClick={() => router.back()}
                            className="glass-button flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    </div>
                </nav>

                {/* Header */}
                <div className="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">Documentation</h1>
                    <p className="text-gray-300 text-lg">
                        Learn how to use the KYC/KYB blockchain platform for decentralized identity verification.
                    </p>
                </div>

                {/* Content */}
                <div className="max-w-4xl mx-auto px-4 pb-20 space-y-8">
                    {sections.map((section, idx) => (
                        <div key={idx} className="glass-card p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
                                    {section.icon}
                                </div>
                                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                            </div>
                            <div className="space-y-4">
                                {section.items.map((item, itemIdx) => (
                                    <div
                                        key={itemIdx}
                                        className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                                    >
                                        <h3 className="font-semibold text-white mb-1">{item.label}</h3>
                                        <p className="text-gray-400 text-sm">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* FAQ Section */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-secondary-500/20 rounded-lg text-secondary-400">
                                <HelpCircle className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
                        </div>
                        <div className="space-y-4">
                            <FAQItem
                                question="Is my data safe?"
                                answer="Yes. All personal information is encrypted before storage. Only cryptographic hashes go on the blockchain."
                            />
                            <FAQItem
                                question="Can I transfer my identity token?"
                                answer="No. Identity tokens are 'Soulbound' - permanently attached to your wallet address."
                            />
                            <FAQItem
                                question="How long does verification take?"
                                answer="Typically 24-48 hours. Complex cases may take longer."
                            />
                            <FAQItem
                                question="Which networks are supported?"
                                answer="Currently: Polygon Mumbai (testnet) and Polygon Mainnet. More networks coming soon."
                            />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="glass-card p-6 text-center">
                        <h3 className="text-xl font-bold text-white mb-2">Need More Help?</h3>
                        <p className="text-gray-400 mb-4">Contact our support team or check out the full developer documentation.</p>
                        <div className="flex justify-center gap-4">
                            <button className="glass-button">Contact Support</button>
                            <a
                                href="https://github.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="primary-button"
                            >
                                GitHub Repository
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FAQItem({ question, answer }) {
    return (
        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <h4 className="font-medium text-white mb-2">{question}</h4>
            <p className="text-gray-400 text-sm">{answer}</p>
        </div>
    );
}
