'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield, Home, FileCheck, Search, Wallet } from 'lucide-react';

export default function Navbar() {
    const pathname = usePathname();

    const navItems = [
        { href: '/', label: 'Home', icon: Home },
        { href: '/dashboard', label: 'Dashboard', icon: Shield },
        { href: '/kyc', label: 'KYC Verification', icon: FileCheck },
        { href: '/verify', label: 'Verify Identity', icon: Search },
        { href: '/wallet', label: 'Transaction Proofs', icon: Wallet },
    ];

    return (
        <nav className="glass-card m-4 p-4 sticky top-4 z-50">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                {/* Logo */}
                <Link href="/" className="flex items-center space-x-3 group">
                    <Shield className="w-8 h-8 text-primary-400 group-hover:scale-110 transition-transform" />
                    <h1 className="text-2xl font-bold text-gradient">KYC/KYB Platform</h1>
                </Link>

                {/* Navigation Links */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    {navItems.slice(1).map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                                    ${isActive
                                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="text-sm font-medium hidden sm:inline">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Wallet Connection */}
                <div className="flex items-center gap-4">
                    <ConnectButton
                        chainStatus="icon"
                        showBalance={false}
                    />
                </div>
            </div>
        </nav>
    );
}
