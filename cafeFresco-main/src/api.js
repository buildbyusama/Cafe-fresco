// One fetch helper for the shop: base URL, session cookie, JSON in/out, never throws on bad JSON.
// Returns { ok, status, data }; network failures resolve to { ok:false, status:0, data:{message} }.
const BASE_URL = import.meta.env.VITE_BASE_URL;

export async function apiFetch(path, { method = 'GET', body, headers = {}, signal } = {}) {
    const init = { method, credentials: 'include', signal, headers: { ...headers } };
    if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    try {
        const res = await fetch(`${BASE_URL}${path}`, init);
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        return { ok: false, status: 0, data: { message: 'Could not reach the server. Check your connection and try again.' } };
    }
}
