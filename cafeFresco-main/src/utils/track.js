import { apiFetch } from '../api';

// Behaviour signals for "Recommended for you". Best effort: never awaited, never shown as an error.
export function trackView(productId) {
    const key = `cf_viewed_${productId}`;
    try {
        if (sessionStorage.getItem(key)) return; // once per dish per visit
        sessionStorage.setItem(key, '1');
    } catch {
        // storage blocked: still send it
    }
    apiFetch('/events', { method: 'POST', body: { type: 'view', productId } }).catch(() => {});
}

export function trackSearch(query) {
    const q = String(query || '').trim();
    if (q.length >= 3) apiFetch('/events', { method: 'POST', body: { type: 'search', query: q } }).catch(() => {});
}
