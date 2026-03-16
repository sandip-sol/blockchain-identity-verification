'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield, Home, FileCheck, Search, Wallet, FileSignature, Activity, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const pathname = usePathname();
    const auth = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { href: '/', label: 'Home', icon: Home },
        { href: '/dashboard', label: 'Dashboard', icon: Shield },
        { href: '/kyc', label: 'KYC Verification', icon: FileCheck },
        { href: '/verify', label: 'Verify Identity', icon: Search },
        { href: '/wallet', label: 'Transaction Proofs', icon: Wallet },
        { href: '/activity', label: 'Activity', icon: Activity },
        { href: '/envelopes', label: 'Envelopes', icon: FileSignature },
        ...(auth.account?.role === 'admin' ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
    ];

    return (
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0c10]/85 backdrop-blur supports-[backdrop-filter]:bg-[#0b0c10]/60">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
                {/* Logo */}
                <Link href="/" className="flex items-center space-x-3 group">
                    <div className="h-9 w-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary-400" />
                    </div>
                    <div className="leading-tight">
                        <div className="text-xs uppercase tracking-widest text-white/50">Identity & Signing</div>
                        <div className="text-lg font-semibold tracking-tight text-white">KYC/KYB Platform</div>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                    {auth.isAuthenticated && navItems.slice(1).map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300
                                    ${isActive
                                        ? 'bg-white/[0.06] text-white border border-white/10'
                                        : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Auth + Wallet */}
                <div className="flex items-center gap-3 ml-auto md:ml-0">
                    {auth.isAuthenticated ? (
                        <button
                            onClick={auth.logout}
                            className="secondary-button"
                            title="Logout"
                        >
                            Logout
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                                Login
                            </Link>
                            <Link href="/login?mode=signup" className="primary-button text-sm px-4 py-2">
                                Sign Up
                            </Link>
                        </div>
                    )}

                    <ConnectButton chainStatus="icon" showBalance={false} />

                    {/* Mobile Menu Toggle */}
                    {auth.isAuthenticated && (
                        <button
                            className="md:hidden p-2 text-white/70 hover:text-white"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            <div className="space-y-1.5">
                                <span className={`block w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                                <span className={`block w-6 h-0.5 bg-current transition-opacity ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
                                <span className={`block w-6 h-0.5 bg-current transition-transform ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isMobileMenuOpen && auth.isAuthenticated && (
                <div className="md:hidden mt-4 pt-4 border-t border-white/10 animate-slide-up grid grid-cols-2 gap-2">
                    {navItems.slice(1).map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`
                                    flex items-center gap-2 px-4 py-3 rounded-lg border transition-all
                                    ${isActive
                                        ? 'bg-white/[0.06] border-white/15 text-white'
                                        : 'bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.06]'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            )}
        </nav>
    );
}
