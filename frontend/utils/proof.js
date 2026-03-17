export function formatHash(value, lead = 12, tail = 8) {
    if (!value) return '-';
    const raw = String(value);
    if (raw.length <= lead + tail + 3) return raw;
    return `${raw.slice(0, lead)}...${raw.slice(-tail)}`;
}

export function formatTimestamp(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

export function statusToBadge(result) {
    return result?.success ? 'verified' : 'rejected';
}
