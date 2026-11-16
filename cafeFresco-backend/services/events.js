// Behaviour events for recommendations: the guest cookie, recording, and merging a guest's history on login
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const UserEvent = require('../models/userEvent');
const { userCookieOptions } = require('../utils/cookies');

const ANON = 'cf_anon';
const ANON_TTL = 180 * 24 * 60 * 60 * 1000;

// Signed guest id (req.signedCookies needs cookieParser(secret) in app.js); null when missing or tampered
const anonIdOf = (req) => {
    const v = req.signedCookies?.[ANON];
    return typeof v === 'string' && /^[a-f0-9]{32}$/.test(v) ? v : null;
};

function ensureAnonId(req, res) {
    const existing = anonIdOf(req);
    if (existing) return existing;
    const id = crypto.randomBytes(16).toString('hex');
    res.cookie(ANON, id, { ...userCookieOptions(), maxAge: ANON_TTL, signed: true });
    req.signedCookies = { ...req.signedCookies, [ANON]: id };
    return id;
}

// The logged-in customer if the cookie is valid, without rejecting guests (routes open to both)
function optionalUserId(req) {
    try {
        const token = cookie.parse(req.headers.cookie || '').userToken;
        return token ? jwt.verify(token, process.env.SECRET_KEY).userId : null;
    } catch {
        return null;
    }
}

const cleanQuery = (q) => String(q || '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80) || null;

// Fire-and-forget: an event must never slow down or break the request that produced it
function record(events) {
    const list = (Array.isArray(events) ? events : [events]).filter((e) => e && (e.userId || e.anonId));
    if (!list.length) return;
    UserEvent.insertMany(list.map((e) => ({ ...e, query: e.query ? cleanQuery(e.query) : null })), { ordered: false }).catch((err) => console.error('Event write failed:', err.message));
}

// After login/signup: the guest's events now belong to the account; the guest id is dropped
async function mergeAnon(req, res, userId) {
    const anonId = anonIdOf(req);
    if (!anonId) return;
    await UserEvent.updateMany({ anonId, userId: null }, { $set: { userId, anonId: null } }).catch((err) => console.error('Event merge failed:', err.message));
    res.clearCookie(ANON, { ...userCookieOptions({ clear: true }), signed: true });
}

module.exports = { ANON, anonIdOf, ensureAnonId, optionalUserId, record, mergeAnon, cleanQuery };
