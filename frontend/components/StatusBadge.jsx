'use client';

import { CheckCircle, Clock, XCircle, AlertCircle, Ban } from 'lucide-react';

const statusConfig = {
    verified: {
        icon: CheckCircle,
        label: 'Verified',
        className: 'bg-green-500/20 text-green-400 border-green-500/50',
    },
    pending: {
        icon: Clock,
        label: 'Pending',
        className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    },
    rejected: {
        icon: XCircle,
        label: 'Rejected',
        className: 'bg-red-500/20 text-red-400 border-red-500/50',
    },
    expired: {
        icon: AlertCircle,
        label: 'Expired',
        className: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    },
    revoked: {
        icon: Ban,
        label: 'Revoked',
        className: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    },
    signed: {
        icon: CheckCircle,
        label: 'Signed',
        className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    finalized: {
        icon: CheckCircle,
        label: 'Finalized',
        className: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    },
    none: {
        icon: AlertCircle,
        label: 'Not Verified',
        className: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    },
};

export default function StatusBadge({ status = 'none', size = 'md', showIcon = true }) {
    const config = statusConfig[status.toLowerCase()] || statusConfig.none;
    const Icon = config.icon;

    const sizeClasses = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-3 py-1.5',
        lg: 'text-base px-4 py-2',
    };

    return (
        <div
            className={`
                inline-flex items-center gap-2 rounded-full border font-medium
                ${config.className} 
                ${sizeClasses[size]}
            `}
        >
            {showIcon && <Icon className="w-4 h-4" />}
            <span>{config.label}</span>
        </div>
    );
}
