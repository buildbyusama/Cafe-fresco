// Only in-app paths are allowed as a post-login target (blocks //evil.com and https://evil.com)
export function safeNext(next, fallback = '/') {
    if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
    if (/^\/(login|signup)(\/|\?|$)/.test(next)) return fallback;
    return next;
}
