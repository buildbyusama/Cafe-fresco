// Only allow in-app admin paths as a post-login target (blocks open redirects like //evil.com)
export function safeNext(next, fallback = '/admin') {
    if (typeof next !== 'string') return fallback;
    if (!next.startsWith('/admin/') || next.startsWith('//') || next.includes('\\')) return fallback;
    if (next.startsWith('/admin/login')) return fallback;
    return next;
}
