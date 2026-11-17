// Short-lived cache for public catalogue reads (SRS 5.1: 500 concurrent shoppers). The menu changes rarely,
// so the same JSON is served for a few seconds instead of re-running the queries for every visitor.
// Never used for admins (they may see inactive dishes) or for anything personal. Any admin change clears it.
const cookie = require('cookie');

const store = new Map(); // key → { at, status, body }
const MAX = 500;

function responseCache(ttlMs = 15000) {
    return (req, res, next) => {
        if (req.method !== 'GET') return next();
        // admin views (?includeInactive etc.) and any admin session bypass the shared cache
        if (cookie.parse(req.headers.cookie || '').adminToken) return next();
        const key = req.originalUrl;
        const hit = store.get(key);
        if (hit && Date.now() - hit.at < ttlMs) {
            res.set('X-Cache', 'HIT');
            return res.status(hit.status).type('application/json').send(hit.body);
        }
        const json = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode === 200) {
                store.set(key, { at: Date.now(), status: 200, body: JSON.stringify(body) });
                if (store.size > MAX) store.delete(store.keys().next().value);
            }
            res.set('X-Cache', 'MISS');
            return json(body);
        };
        next();
    };
}

const clear = () => store.clear();

module.exports = { responseCache, clear };
