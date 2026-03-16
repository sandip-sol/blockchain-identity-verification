'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function TransactionTable({ transactions = [], loading = false }) {
    const [sortField, setSortField] = useState('timestamp');
    const [sortDirection, setSortDirection] = useState('desc');
    const [searchTerm, setSearchTerm] = useState('');

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const filteredAndSorted = useMemo(() => {
        let filtered = transactions;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(tx =>
                tx.hash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tx.type?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === 'timestamp') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }

            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return filtered;
    }, [transactions, searchTerm, sortField, sortDirection]);

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc'
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />;
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString();
    };

    const truncateHash = (hash) => {
        if (!hash) return '-';
        return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
    };

    if (loading) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-700 rounded w-1/4 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by hash or type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                             focus:outline-none focus:border-primary-500 text-white placeholder-gray-400"
                />
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th
                                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => handleSort('type')}
                                >
                                    <div className="flex items-center gap-2">
                                        Type
                                        <SortIcon field="type" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => handleSort('hash')}
                                >
                                    <div className="flex items-center gap-2">
                                        Transaction Hash
                                        <SortIcon field="hash" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center gap-2">
                                        Status
                                        <SortIcon field="status" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => handleSort('timestamp')}
                                >
                                    <div className="flex items-center gap-2">
                                        Timestamp
                                        <SortIcon field="timestamp" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSorted.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSorted.map((tx, index) => (
                                    <tr
                                        key={index}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-medium">{tx.type || 'Unknown'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-primary-400">
                                                {truncateHash(tx.hash)}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={tx.status || 'pending'} size="sm" />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {formatDate(tx.timestamp)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
