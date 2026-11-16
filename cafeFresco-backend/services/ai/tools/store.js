// Shop facts (Store Info settings) and the admin FAQ. Empty facts are reported as unknown, never guessed (A1).
const Knowledge = require('../../../models/knowledge');
const { getSettings, openNow, hoursText } = require('../../settings');
const { embed, AiError } = require('../client');
const { cosine } = require('../embeddings');

const money = (n) => `${Number(n).toFixed(2)}`;
const UNKNOWN = "The shop hasn't published this yet.";

function storeAnswer(s, topic) {
    const c = s.contact || {};
    switch (topic) {
        case 'hours':
            return hoursText(s.hours || []) || UNKNOWN;
        case 'open_now': {
            const open = openNow(s.hours);
            return open === null ? UNKNOWN : open ? 'Open right now.' : `Closed right now.${s.hours?.length ? `\nHours:\n${hoursText(s.hours)}` : ''}`;
        }
        case 'contact': {
            const parts = [c.phone && `Phone: ${c.phone}`, c.email && `Email: ${c.email}`, c.address && `Address: ${c.address}`].filter(Boolean);
            return parts.length ? parts.join('\n') : `${UNKNOWN} Customers can use the Contact page form.`;
        }
        case 'delivery': {
            const d = s.delivery || {};
            const parts = [
                `Delivery fee: ${d.fee > 0 ? money(d.fee) : 'free'}`,
                d.minOrder > 0 ? `Minimum order: ${money(d.minOrder)}` : null,
                d.etaMinutes ? `Typical delivery time: about ${d.etaMinutes} minutes` : null,
                d.areas?.length ? `Areas: ${d.areas.join(', ')}` : 'Delivery areas: not published',
                s.policies?.delivery || null,
            ].filter(Boolean);
            return parts.join('\n');
        }
        case 'payments': {
            const p = s.payments || {};
            return `Payment methods: ${[p.card && 'card (Stripe)', p.cod && 'cash on delivery'].filter(Boolean).join(' and ')}.`;
        }
        case 'policies':
            return [`Cancellation: ${s.policies?.cancellation || UNKNOWN}`, `Refunds: ${s.policies?.refunds || UNKNOWN}`].join('\n');
        default:
            return UNKNOWN;
    }
}

const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);

// Top 3 active FAQ entries. Semantic when AI is available (threshold), keyword overlap otherwise.
async function searchKnowledge(query) {
    const entries = await Knowledge.find({ isActive: true }).select('+embedding question answer').lean();
    if (!entries.length) return [];
    const q = String(query || '').slice(0, 300);
    let qvec = null;
    try {
        [qvec] = await embed([q]);
    } catch (err) {
        if (!(err instanceof AiError)) throw err;
    }
    const qw = words(q);
    const scored = entries.map((e) => {
        const kw = qw.length ? qw.filter((w) => words(`${e.question} ${e.answer}`).includes(w)).length / qw.length : 0;
        const sem = qvec && e.embedding?.length ? cosine(qvec, e.embedding) : 0;
        return { e, score: qvec && e.embedding?.length ? 0.8 * sem + 0.2 * kw : kw, sem, kw };
    });
    // unrelated questions must come back empty, so the assistant says it doesn't know
    return scored
        .filter((s) => (qvec && s.e.embedding?.length ? s.sem >= 0.45 || s.kw >= 0.6 : s.kw >= 0.5))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ e }) => ({ question: e.question, answer: e.answer }));
}

module.exports = [
    {
        name: 'get_store_info',
        description: 'Cafe Fresco facts: opening hours, whether it is open now, contact details, delivery (fee, areas, time), payment methods, cancellation and refund policy.',
        parameters: {
            type: 'object',
            additionalProperties: false,
            required: ['topic'],
            properties: { topic: { type: 'string', enum: ['hours', 'open_now', 'contact', 'delivery', 'payments', 'policies'] } },
        },
        async handler({ topic }) {
            return { data: { topic, answer: storeAnswer(await getSettings(), topic) } };
        },
    },
    {
        name: 'search_knowledge',
        description: "The shop's FAQ written by staff (e.g. parking, catering, events, halal, kids). Use for questions not about dishes, orders or the basic store info.",
        parameters: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string' } } },
        async handler({ query }) {
            const entries = await searchKnowledge(query);
            return { data: entries.length ? { entries } : { entries: [], note: 'No FAQ entry answers this. Say you do not know and suggest the Contact page.' } };
        },
    },
];

module.exports.storeAnswer = storeAnswer;
module.exports.searchKnowledge = searchKnowledge;
