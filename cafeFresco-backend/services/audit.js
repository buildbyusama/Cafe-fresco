// Activity log + error monitoring (SRS 5.8).
// - auditTrail: every successful admin change (POST/PUT/PATCH/DELETE by a signed-in admin) is recorded,
//   so no route can forget to log. Never blocks or breaks the request.
// - errorBurst: more than 10 server errors in a minute → one dashboard alert (deduplicated).
const AuditLog = require('../models/auditLog');
const { alert } = require('./alerts');

const SECRET = /pass|token|secret|key|card|cvc|cvv/i;
const ENTITY = [
    [/^\/product\/inventory/, 'inventory'], [/^\/product/, 'product'], [/^\/category/, 'category'], [/^\/order/, 'order'],
    [/^\/discount/, 'discount'], [/^\/admin\/(create|update|delete)-permission/, 'permission'], [/^\/settings/, 'settings'],
    [/^\/knowledge/, 'knowledge'], [/^\/employee/, 'employee'], [/^\/department/, 'department'], [/^\/supplier/, 'supplier'],
    [/^\/distributer/, 'distributor'], [/^\/chat\/admin/, 'assistant'], [/^\/admin\/mark-seen/, null], [/^\/admin\/(login|logout|forgot|reset)/, null],
];

const entityOf = (path) => {
    for (const [re, name] of ENTITY) if (re.test(path)) return name;
    return 'other';
};

// fields sent, without secrets, files or huge values
function changesOf(body) {
    if (!body || typeof body !== 'object') return {};
    const out = {};
    for (const [k, v] of Object.entries(body).slice(0, 30)) {
        if (SECRET.test(k)) out[k] = '[hidden]';
        else if (v && typeof v === 'object') out[k] = JSON.stringify(v).slice(0, 200);
        else out[k] = String(v).slice(0, 200);
    }
    return out;
}

function auditTrail(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    // a new record's id is only in the response body: keep it for the log
    const json = res.json.bind(res);
    res.json = (body) => {
        const doc = body && typeof body === 'object' ? Object.values(body).find((v) => v && typeof v === 'object' && v._id) : null;
        res.locals.auditId = doc?._id || body?._id || null;
        return json(body);
    };
    res.on('finish', () => {
        if (!req.admin?.userId || res.statusCode >= 400) return;
        const path = req.originalUrl.split('?')[0];
        const entity = entityOf(path);
        if (!entity) return; // sign-in, reading notifications: not changes
        const action = req.method === 'DELETE' || /\/delete/.test(path) ? 'delete' : /\/(add|create|register)\b/.test(path) || (req.method === 'POST' && !/update|mark|reindex|test/.test(path)) ? 'create' : 'update';
        const entityId = req.params?.id || path.match(/[0-9a-f]{24}/)?.[0] || req.body?.orderId || res.locals.auditId || req.body?.email || null;
        AuditLog.create({
            adminId: req.admin.userId,
            adminName: req.admin.name || '',
            role: req.admin.role || '',
            action,
            entity,
            entityId: entityId ? String(entityId).slice(0, 120) : null,
            summary: `${req.method} ${path}`.slice(0, 200),
            changes: changesOf(req.body),
        }).catch((err) => console.error('Audit write failed:', err.message));
    });
    next();
}

// ---- 5xx bursts ----
let window = [];
function errorBurst(req, res, next) {
    res.on('finish', () => {
        if (res.statusCode < 500) return;
        const now = Date.now();
        window = window.filter((t) => now - t < 60 * 1000);
        window.push(now);
        if (window.length > 10) {
            alert({ type: 'system_error', message: `The server returned ${window.length} errors in the last minute. Check the logs (search for "level":50).`, key: 'burst', windowMs: 15 * 60 * 1000 });
        }
    });
    next();
}

module.exports = { auditTrail, errorBurst, changesOf, entityOf };
