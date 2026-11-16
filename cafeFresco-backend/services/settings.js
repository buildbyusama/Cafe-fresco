// Store settings: read (cached), validate, and plain-language answers for the assistant
const validator = require('validator');
const Setting = require('../models/setting');
const { TZ, now } = require('./stats');
const { PHONE_REGEX } = require('../utils/validation');

// Truthful defaults taken from how the system already works (not invented business facts)
const DEFAULT_POLICIES = {
    cancellation: 'You can cancel an order yourself from My orders while it is pending and unpaid. After that, please contact us.',
    refunds: 'If a paid order is cancelled, our team refunds it to the original card.',
};

let cache = null;
let cachedAt = 0;
const TTL = 60 * 1000;

async function getSettings() {
    if (cache && Date.now() - cachedAt < TTL) return cache;
    let doc = await Setting.findOne({ key: 'store' }).lean();
    if (!doc) doc = (await Setting.findOneAndUpdate({ key: 'store' }, { $setOnInsert: { key: 'store' } }, { upsert: true, new: true, setDefaultsOnInsert: true })).toObject();
    doc.policies = { ...doc.policies, cancellation: doc.policies?.cancellation || DEFAULT_POLICIES.cancellation, refunds: doc.policies?.refunds || DEFAULT_POLICIES.refunds };
    cache = doc;
    cachedAt = Date.now();
    return doc;
}

const bust = () => { cache = null; };

// What the website may see (no escalation email, no budget, no ids)
function publicView(s) {
    return {
        contact: s.contact,
        hours: s.hours,
        openNow: openNow(s.hours),
        delivery: s.delivery,
        payments: s.payments,
        policies: s.policies,
        social: s.social,
        chatbot: { enabled: s.chatbot?.enabled !== false, greeting: s.chatbot?.greeting || '', hiddenOn: s.chatbot?.hiddenOn || [] },
    };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

// null when hours are not set; true/false otherwise. Handles closing after midnight.
function openNow(hours, at = now()) {
    if (!Array.isArray(hours) || !hours.length) return null;
    const day = at.day();
    const minute = at.hours() * 60 + at.minutes();
    const rows = (d) => hours.filter((h) => h.day === d && !h.closed && TIME.test(h.open) && TIME.test(h.close));
    // today's window (a close earlier than open runs past midnight)
    for (const h of rows(day)) {
        const o = toMin(h.open), c = toMin(h.close);
        if (c > o ? minute >= o && minute < c : minute >= o) return true;
    }
    // yesterday's window still open after midnight
    for (const h of rows((day + 6) % 7)) {
        const o = toMin(h.open), c = toMin(h.close);
        if (c <= o && minute < c) return true;
    }
    return false;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt12 = (hhmm) => {
    const h = Number(hhmm.slice(0, 2)), m = hhmm.slice(3);
    return `${((h + 11) % 12) + 1}${m === '00' ? '' : ':' + m} ${h < 12 ? 'am' : 'pm'}`;
};
const hoursText = (hours) =>
    hours.length
        ? [...hours].sort((a, b) => a.day - b.day).map((h) => `${DAYS[h.day]}: ${h.closed ? 'closed' : `${fmt12(h.open)} – ${fmt12(h.close)}`}`).join('\n')
        : '';

// Validate an admin update → { value } or { fields }
function parseUpdate(body) {
    const fields = {};
    const value = {};
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    if (body.contact) {
        const c = body.contact;
        value.contact = { phone: str(c.phone, 30), email: str(c.email, 120).toLowerCase(), address: str(c.address, 200), mapUrl: str(c.mapUrl, 500) };
        if (value.contact.phone && !PHONE_REGEX.test(value.contact.phone)) fields['contact.phone'] = 'Enter a valid phone number';
        if (value.contact.email && !validator.isEmail(value.contact.email)) fields['contact.email'] = 'Enter a valid email';
        if (value.contact.mapUrl && !validator.isURL(value.contact.mapUrl, { protocols: ['https'], require_protocol: true })) fields['contact.mapUrl'] = 'Use an https:// link';
    }
    if (body.hours !== undefined) {
        if (!Array.isArray(body.hours) || body.hours.length > 14) fields.hours = 'Invalid opening hours';
        else {
            value.hours = body.hours.map((h) => ({ day: Number(h.day), open: str(h.open, 5), close: str(h.close, 5), closed: h.closed === true }));
            value.hours.forEach((h, i) => {
                if (!Number.isInteger(h.day) || h.day < 0 || h.day > 6) fields[`hours.${i}`] = 'Invalid day';
                else if (!h.closed && (!TIME.test(h.open) || !TIME.test(h.close) || h.open === h.close)) fields[`hours.${i}`] = `${DAYS[h.day]}: enter opening and closing times (HH:mm)`;
            });
        }
    }
    if (body.delivery) {
        const d = body.delivery;
        const num = (v) => (v === '' || v == null ? null : Number(v));
        value.delivery = {
            areas: Array.isArray(d.areas) ? [...new Set(d.areas.map((a) => str(a, 60)).filter(Boolean))].slice(0, 50) : [],
            fee: num(d.fee) ?? 0,
            minOrder: num(d.minOrder) ?? 0,
            etaMinutes: num(d.etaMinutes),
        };
        if (!(value.delivery.fee >= 0)) fields['delivery.fee'] = 'Fee must be 0 or more';
        if (!(value.delivery.minOrder >= 0)) fields['delivery.minOrder'] = 'Minimum order must be 0 or more';
        if (value.delivery.etaMinutes !== null && !(Number.isInteger(value.delivery.etaMinutes) && value.delivery.etaMinutes > 0 && value.delivery.etaMinutes <= 600)) fields['delivery.etaMinutes'] = 'Delivery time must be 1–600 minutes';
    }
    if (body.payments) value.payments = { card: body.payments.card !== false, cod: body.payments.cod !== false };
    if (body.payments && !value.payments.card && !value.payments.cod) fields.payments = 'Keep at least one payment method';
    if (body.policies) value.policies = { cancellation: str(body.policies.cancellation, 600), refunds: str(body.policies.refunds, 600), delivery: str(body.policies.delivery, 600) };
    if (body.social) {
        value.social = { facebook: str(body.social.facebook, 300), instagram: str(body.social.instagram, 300), twitter: str(body.social.twitter, 300) };
        for (const [k, v] of Object.entries(value.social)) if (v && !validator.isURL(v, { protocols: ['https'], require_protocol: true })) fields[`social.${k}`] = 'Use an https:// link';
    }
    if (body.chatbot) {
        const c = body.chatbot;
        value.chatbot = {
            enabled: c.enabled !== false,
            greeting: str(c.greeting, 200),
            escalationEmail: str(c.escalationEmail, 120).toLowerCase(),
            dailyTokenBudget: c.dailyTokenBudget === '' || c.dailyTokenBudget == null ? null : Number(c.dailyTokenBudget),
            hiddenOn: Array.isArray(c.hiddenOn) ? c.hiddenOn.map((p) => str(p, 60)).filter((p) => p.startsWith('/')).slice(0, 20) : ['/address', '/payment'],
        };
        if (value.chatbot.escalationEmail && !validator.isEmail(value.chatbot.escalationEmail)) fields['chatbot.escalationEmail'] = 'Enter a valid email';
        const max = Number(process.env.AI_DAILY_TOKEN_BUDGET || 2000000);
        if (value.chatbot.dailyTokenBudget !== null && !(Number.isInteger(value.chatbot.dailyTokenBudget) && value.chatbot.dailyTokenBudget >= 0 && value.chatbot.dailyTokenBudget <= max)) fields['chatbot.dailyTokenBudget'] = `Budget must be 0–${max} tokens`;
    }
    return Object.keys(fields).length ? { fields } : { value };
}

async function saveSettings(value, adminId) {
    const set = {};
    // whole groups are replaced, so a partial body never mixes old and new values inside a group
    for (const [k, v] of Object.entries(value)) set[k] = v;
    await Setting.updateOne({ key: 'store' }, { $set: { ...set, updatedBy: adminId } }, { upsert: true, runValidators: true });
    bust();
    return getSettings();
}

module.exports = { getSettings, publicView, parseUpdate, saveSettings, openNow, hoursText, bust, TZ, DEFAULT_POLICIES };
