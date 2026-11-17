// Dashboard alerts (SRS 4.7 / 5.8): one place that writes notifications for problems, with de-duplication
// so an outage or a burst produces one alert, not hundreds. Never throws.
const Notify = require('../models/notification');

const MIN = 60 * 1000;

/**
 * type: 'ai_error' | 'system_error' | 'payment_issue' | 'chat_escalation'
 * key + windowMs: skip if a notification with the same type+key was created within the window
 */
// same-process guard: during a burst many calls arrive before the first one is saved
const claimed = new Map();

async function alert({ type, name = 'System', message, link = null, orderId = null, key = null, windowMs = 15 * MIN }) {
    try {
        if (key) {
            const k = `${type}:${key}`;
            const at = claimed.get(k);
            if (at && Date.now() - at < windowMs) return false;
            claimed.set(k, Date.now());
            if (claimed.size > 1000) claimed.delete(claimed.keys().next().value);
        }
        if (key && (await Notify.exists({ type, key, time: { $gte: new Date(Date.now() - windowMs) } }))) return false;
        await Notify.create({ type, name, message: String(message).slice(0, 300), link, orderId, key });
        return true;
    } catch (err) {
        console.error('Alert failed:', err.message);
        return false;
    }
}

const AI_REASON = {
    timeout: 'OpenAI is responding slowly (timeouts)',
    upstream: 'OpenAI is unavailable',
    rate_limited: 'OpenAI is rate-limiting requests',
};

// AI outage / budget: at most one alert per 15 min per cause (budget: once a day)
function aiProblem(code) {
    if (code === 'budget') return alert({ type: 'ai_error', message: "Today's AI budget is used up. The assistant is using rule-based answers until midnight.", link: '/admin/ai-settings', key: `budget:${new Date().toISOString().slice(0, 10)}`, windowMs: 24 * 60 * MIN });
    if (AI_REASON[code]) return alert({ type: 'ai_error', message: `${AI_REASON[code]}. The assistant switched to rule-based answers.`, link: '/admin/ai-settings', key: `ai:${code}` });
    return Promise.resolve(false);
}

module.exports = { alert, aiProblem };
