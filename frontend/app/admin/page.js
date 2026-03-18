'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Shield, Users, UserCheck, Clock, Search, Trash2, KeyRound,
    ChevronLeft, ChevronRight, AlertCircle, CheckCircle, X, Eye,
    ShieldCheck, Wallet, Mail
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent } from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { useAPI } from '../../hooks/useAPI';
import { canAccessAdmin } from '../../utils/rbac';

export default function AdminDashboard() {
    const router = useRouter();
    const auth = useAuth();
    const api = useAPI();

    const [stats, setStats] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [toast, setToast] = useState(null);

    // Modal states
    const [deleteModal, setDeleteModal] = useState(null);
    const [resetModal, setResetModal] = useState(null);
    const [detailModal, setDetailModal] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    // Check admin access
    useEffect(() => {
        if (auth.hydrated && (!auth.isAuthenticated || !canAccessAdmin(auth.account?.normalizedRole || auth.account?.role))) {
            router.push('/dashboard');
        }
    }, [auth.hydrated, auth.isAuthenticated, auth.account, router]);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const data = await api.get('/api/admin/stats');
            setStats(data);
        } catch (err) {
            console.error('Stats error:', err);
        }
    }, [api]);

    const fetchAccounts = useCallback(async (page = 1, searchQuery = '') => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (searchQuery) params.set('search', searchQuery);
            const data = await api.get(`/api/admin/accounts?${params}`);
            setAccounts(data.accounts);
            setPagination(data.pagination);
        } catch (err) {
            setError('Failed to load accounts');
            console.error('Accounts error:', err);
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        if (canAccessAdmin(auth.account?.normalizedRole || auth.account?.role)) {
            fetchStats();
            fetchAccounts();
        }
    }, [auth.account]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        fetchAccounts(1, searchInput);
    };

    const handleDelete = async (id) => {
        setActionLoading(id);
        try {
            await api.delete(`/api/admin/accounts/${id}`);
            showToast('Account deleted successfully');
            setDeleteModal(null);
            fetchAccounts(pagination.page, search);
            fetchStats();
        } catch (err) {
            showToast(err.response?.data?.error || 'Delete failed', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleResetPassword = async (id) => {
        if (newPassword.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }
        setActionLoading(id);
        try {
            await api.post(`/api/admin/accounts/${id}/reset-password`, { newPassword });
            showToast('Password reset successfully');
            setResetModal(null);
            setNewPassword('');
        } catch (err) {
            showToast(err.response?.data?.error || 'Reset failed', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewDetail = async (id) => {
        try {
            const data = await api.get(`/api/admin/accounts/${id}`);
            setDetailModal(data);
        } catch (err) {
            showToast('Failed to load account details', 'error');
        }
    };

    const formatDate = (date) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const truncateAddress = (addr) => {
        if (!addr) return '—';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    if (!auth.hydrated || !canAccessAdmin(auth.account?.normalizedRole || auth.account?.role)) {
        return (
            <div className="min-h-screen">
                <Navbar />
                <div className="flex items-center justify-center h-[60vh]">
                    <div className="animate-pulse text-gray-400">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-primary-400" />
                        </div>
                        <h1 className="text-4xl font-bold text-gradient">Admin Dashboard</h1>
                    </div>
                    <p className="text-gray-400">Manage accounts, view platform statistics, and monitor KYC status.</p>
                    <div className="mt-4">
                        <Link href="/admin/kyc" className="secondary-button inline-flex items-center gap-2 px-4 py-2">
                            <ShieldCheck className="w-4 h-4" />
                            Open KYC Review Queue
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard icon={Users} label="Total Accounts" value={stats.accounts.total} color="primary" />
                        <StatCard icon={UserCheck} label="Verified Users" value={stats.kyc.verified} color="green" />
                        <StatCard icon={Clock} label="Pending KYC" value={stats.kyc.pending} color="yellow" />
                        <StatCard icon={Users} label="New Today" value={stats.accounts.today} color="blue" />
                    </div>
                )}

                {/* Search & Accounts Table */}
                <Card>
                    <CardHeader
                        title="All Accounts"
                        subtitle={`${pagination.total} accounts total`}
                        action={
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder="Search email or name..."
                                        className="input-field pl-10 py-2 text-sm w-64"
                                    />
                                </div>
                                <button type="submit" className="secondary-button text-sm px-4 py-2">
                                    Search
                                </button>
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearch(''); setSearchInput(''); fetchAccounts(1, ''); }}
                                        className="secondary-button text-sm px-3 py-2"
                                        title="Clear search"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </form>
                        }
                    />
                    <CardContent>
                        {error && (
                            <div className="glass-card p-4 border-red-500/20 bg-red-500/10 flex items-center gap-3 mb-4">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                                <p className="text-red-200 text-sm">{error}</p>
                            </div>
                        )}

                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-pulse text-gray-400">Loading accounts...</div>
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                {search ? `No accounts matching "${search}"` : 'No accounts found'}
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Email</th>
                                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Name</th>
                                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Role</th>
                                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Wallet</th>
                                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Created</th>
                                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Last Login</th>
                                                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accounts.map((account) => (
                                                <tr key={account._id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                            <span className="text-sm text-gray-200 font-medium">{account.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-300">{account.name || '—'}</td>
                                                    <td className="py-3 px-4">
                                                        <RoleBadge role={account.role || 'user'} />
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {account.address ? (
                                                            <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
                                                                {truncateAddress(account.address)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 text-sm">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-400">{formatDate(account.createdAt)}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-400">{formatDate(account.lastLoginAt)}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => handleViewDetail(account._id)}
                                                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors"
                                                                title="View details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setResetModal(account)}
                                                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-yellow-400 transition-colors"
                                                                title="Reset password"
                                                            >
                                                                <KeyRound className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteModal(account)}
                                                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                                                                title="Delete account"
                                                                disabled={account._id === auth.account?._id}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden space-y-3">
                                    {accounts.map((account) => (
                                        <div key={account._id} className="glass-card p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-200">{account.email}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">{account.name || 'No name'}</p>
                                                </div>
                                                <RoleBadge role={account.role || 'user'} />
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                                                {account.address && (
                                                    <span className="font-mono bg-white/5 px-2 py-0.5 rounded">
                                                        {truncateAddress(account.address)}
                                                    </span>
                                                )}
                                                <span>Joined {formatDate(account.createdAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-1 border-t border-white/5 pt-3">
                                                <button onClick={() => handleViewDetail(account._id)} className="flex-1 secondary-button text-xs py-1.5"><Eye className="w-3 h-3 inline mr-1" />View</button>
                                                <button onClick={() => setResetModal(account)} className="flex-1 secondary-button text-xs py-1.5"><KeyRound className="w-3 h-3 inline mr-1" />Reset</button>
                                                <button
                                                    onClick={() => setDeleteModal(account)}
                                                    disabled={account._id === auth.account?._id}
                                                    className="flex-1 secondary-button text-xs py-1.5 text-red-400 border-red-400/20 disabled:opacity-30"
                                                ><Trash2 className="w-3 h-3 inline mr-1" />Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {pagination.pages > 1 && (
                                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                                        <p className="text-sm text-gray-400">
                                            Page {pagination.page} of {pagination.pages}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => fetchAccounts(pagination.page - 1, search)}
                                                disabled={pagination.page <= 1}
                                                className="secondary-button text-sm px-3 py-1.5 disabled:opacity-30"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => fetchAccounts(pagination.page + 1, search)}
                                                disabled={pagination.page >= pagination.pages}
                                                className="secondary-button text-sm px-3 py-1.5 disabled:opacity-30"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ═══════ MODALS ═══════ */}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <Modal onClose={() => setDeleteModal(null)}>
                    <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7 text-red-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Delete Account</h3>
                        <p className="text-gray-400 text-sm mb-1">Are you sure you want to delete this account?</p>
                        <p className="text-gray-200 font-medium mb-6">{deleteModal.email}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModal(null)} className="secondary-button flex-1 py-2.5">Cancel</button>
                            <button
                                onClick={() => handleDelete(deleteModal._id)}
                                disabled={actionLoading === deleteModal._id}
                                className="flex-1 py-2.5 rounded-full font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                                {actionLoading === deleteModal._id ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Reset Password Modal */}
            {resetModal && (
                <Modal onClose={() => { setResetModal(null); setNewPassword(''); }}>
                    <div>
                        <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
                            <KeyRound className="w-7 h-7 text-yellow-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-1 text-center">Reset Password</h3>
                        <p className="text-gray-400 text-sm text-center mb-6">{resetModal.email}</p>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                            <input
                                type="text"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 8 characters"
                                className="input-field"
                                minLength={8}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setResetModal(null); setNewPassword(''); }} className="secondary-button flex-1 py-2.5">Cancel</button>
                            <button
                                onClick={() => handleResetPassword(resetModal._id)}
                                disabled={actionLoading === resetModal._id || newPassword.length < 8}
                                className="primary-button flex-1 py-2.5 disabled:opacity-50"
                            >
                                {actionLoading === resetModal._id ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Account Detail Modal */}
            {detailModal && (
                <Modal onClose={() => setDetailModal(null)} wide>
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-primary-500/10 border border-primary-500/30 flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white">{detailModal.account.name || 'Unnamed'}</h3>
                                <p className="text-gray-400 text-sm">{detailModal.account.email}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <DetailRow label="Account ID" value={detailModal.account._id} mono />
                            <DetailRow label="Role" value={detailModal.account.role || 'user'} />
                            <DetailRow label="Created" value={formatDate(detailModal.account.createdAt)} />
                            <DetailRow label="Last Login" value={formatDate(detailModal.account.lastLoginAt)} />
                            <DetailRow label="Wallet" value={detailModal.account.address || 'Not linked'} mono={!!detailModal.account.address} />
                        </div>

                        {detailModal.kycUser && (
                            <div className="border-t border-white/10 pt-4">
                                <h4 className="text-sm font-medium text-gray-300 mb-3">KYC Data</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailRow label="Status" value={detailModal.kycUser.verificationStatus} />
                                    <DetailRow label="Type" value={detailModal.kycUser.verificationType} />
                                    <DetailRow label="Full Name" value={detailModal.kycUser.kycData?.fullName} />
                                    <DetailRow label="Nationality" value={detailModal.kycUser.kycData?.nationality} />
                                    <DetailRow label="Token ID" value={detailModal.kycUser.identityTokenId} mono />
                                    <DetailRow label="Verified At" value={formatDate(detailModal.kycUser.verifiedAt)} />
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setDetailModal(null)} className="secondary-button px-6 py-2">Close</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Toast notification */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl animate-slide-up
                    ${toast.type === 'error'
                        ? 'bg-red-500/10 border-red-500/30 text-red-200'
                        : 'bg-green-500/10 border-green-500/30 text-green-200'
                    }`}
                >
                    {toast.type === 'error'
                        ? <AlertCircle className="w-5 h-5 text-red-400" />
                        : <CheckCircle className="w-5 h-5 text-green-400" />
                    }
                    <p className="text-sm font-medium">{toast.message}</p>
                    <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ════════════ Sub-components ════════════

function StatCard({ icon: Icon, label, value, color }) {
    const colorMap = {
        primary: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
        green: 'text-green-400 bg-green-500/10 border-green-500/20',
        yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    };
    const iconColor = colorMap[color] || colorMap.primary;

    return (
        <div className="glass-card p-5 hover:bg-white/[0.05] transition-all">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconColor}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-sm text-gray-400">{label}</p>
        </div>
    );
}

function RoleBadge({ role }) {
    if (role === 'admin') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                <ShieldCheck className="w-3 h-3" />Admin
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-gray-400 border border-white/10">
            User
        </span>
    );
}

function Modal({ children, onClose, wide = false }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className={`relative glass-card p-6 ${wide ? 'max-w-2xl' : 'max-w-md'} w-full max-h-[85vh] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
                {children}
            </div>
        </div>
    );
}

function DetailRow({ label, value, mono = false }) {
    return (
        <div>
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className={`text-sm text-gray-200 ${mono ? 'font-mono break-all' : ''}`}>{value || '—'}</p>
        </div>
    );
}
