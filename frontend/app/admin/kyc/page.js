'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Filter, Search, ShieldCheck } from 'lucide-react';
import Navbar from '../../../components/Navbar';
import Card, { CardContent, CardHeader } from '../../../components/Card';
import StatusBadge from '../../../components/StatusBadge';
import { useAuth } from '../../../context/AuthContext';
import { useAPI } from '../../../hooks/useAPI';
import { canAccessAdmin } from '../../../utils/rbac';

const STATUS_OPTIONS = ['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'VERIFIED', 'FAILED', 'RESUBMISSION_REQUIRED'];

export default function AdminKycListPage() {
  const router = useRouter();
  const auth = useAuth();
  const api = useAPI();

  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    const data = await api.get('/api/admin/kyc/stats');
    setStats(data.stats);
  }, [api]);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'ALL') params.set('status', status);
      if (search) params.set('search', search);
      const data = await api.get(`/api/admin/kyc?${params.toString()}`);
      setApplications(data.applications || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load KYC applications');
    } finally {
      setLoading(false);
    }
  }, [api, page, search, status]);

  useEffect(() => {
    if (auth.hydrated && !canAccessAdmin(auth.account?.normalizedRole || auth.account?.role)) {
      router.push('/dashboard');
    }
  }, [auth.account, auth.hydrated, router]);

  useEffect(() => {
    if (auth.hydrated && canAccessAdmin(auth.account?.normalizedRole || auth.account?.role)) {
      loadStats().catch(() => {});
      loadApplications();
    }
  }, [auth.account, auth.hydrated, loadApplications, loadStats]);

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
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary-400" />
              </div>
              <h1 className="text-4xl font-bold text-gradient">KYC Review Queue</h1>
            </div>
            <p className="text-gray-400">Review submissions, approve or reject cases, and trigger on-chain identity verification.</p>
          </div>
          <Link href="/admin" className="secondary-button px-4 py-2">Back to Admin</Link>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Submitted" value={stats.submitted} />
            <StatCard label="Under Review" value={stats.underReview} />
            <StatCard label="Verified" value={stats.verified} />
          </div>
        )}

        <Card>
          <CardHeader
            title="Applications"
            subtitle={`${pagination.total} applications`}
            action={
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
                className="flex flex-col gap-2 md:flex-row"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search wallet, email, name, ID..."
                    className="input-field pl-10 py-2 text-sm w-72"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="input-field pl-10 py-2 text-sm w-56"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option === 'ALL' ? 'All statuses' : option.replaceAll('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="primary-button px-4 py-2 text-sm">Search</button>
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
              <div className="text-center py-12 text-gray-400">Loading KYC applications...</div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No KYC applications match your current filters.</div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Application</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Applicant</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Wallet</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Status</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Submitted</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Reviewed By</th>
                        <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Risk</th>
                        <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.applicationId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="text-sm text-white font-medium">{app.applicationId}</div>
                            <div className="text-xs text-gray-500">{app.verificationType}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-200">{app.summary?.fullName || app.summary?.businessName || 'Unknown applicant'}</div>
                            <div className="text-xs text-gray-500">{app.summary?.email || 'No email provided'}</div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-gray-400">{shorten(app.walletAddress)}</td>
                          <td className="py-3 px-4"><StatusBadge status={app.status} size="sm" /></td>
                          <td className="py-3 px-4 text-sm text-gray-400">{formatDate(app.submittedAt)}</td>
                          <td className="py-3 px-4 text-sm text-gray-400">{app.reviewedBy?.email || 'Unassigned'}</td>
                          <td className="py-3 px-4 text-sm text-gray-300">{app.currentRiskLevel || 'UNKNOWN'}</td>
                          <td className="py-3 px-4 text-right">
                            <Link href={`/admin/kyc/${app.applicationId}`} className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-sm">
                              Open
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 lg:hidden">
                  {applications.map((app) => (
                    <div key={app.applicationId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{app.applicationId}</p>
                          <p className="text-xs text-gray-500">{app.summary?.fullName || app.summary?.businessName || 'Unknown applicant'}</p>
                        </div>
                        <StatusBadge status={app.status} size="sm" />
                      </div>
                      <p className="text-xs font-mono text-gray-400">{app.walletAddress}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(app.submittedAt)}</span>
                        <span>{app.currentRiskLevel || 'UNKNOWN'}</span>
                      </div>
                      <Link href={`/admin/kyc/${app.applicationId}`} className="secondary-button block text-center py-2 text-sm">Open Review</Link>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {pagination.page} of {Math.max(pagination.pages, 1)}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="secondary-button text-sm px-3 py-2 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages || 1, p + 1))}
                  disabled={page >= (pagination.pages || 1)}
                  className="secondary-button text-sm px-3 py-2 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="glass-card p-5 border-white/10">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function shorten(value) {
  if (!value) return '—';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
