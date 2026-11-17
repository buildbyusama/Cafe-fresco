// search_documents: passages from the shop's published documents (docs/RAG_PLAN.md R3.1).
// Document text is untrusted data (R4) and never a source of live facts like prices (R1).
const { retrieve } = require('../../rag/retrieve');
const { cleanTitle, stripTags } = require('../../../models/document');

// R1: a document's prices are never quoted (an old menu PDF must not beat the database)
const PRICE = /(?:\$|rs\.?|pkr|usd)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:rs\b|rupees|pkr|dollars?|usd)/gi;
// R4: sentences that try to instruct the assistant are dropped (they are data, never commands)
const INJECTION = /ignore (all |any |the )?(previous|above|prior|earlier|your)|system prompt|you are now|developer mode|new instructions|disregard (all|the|your)|reveal (your|the) (prompt|instructions|key)|^\s*(system|assistant)\s*:|ہدایات|نظر ?انداز|hidayat|pichli (baat|hidayat)|bhool jao/i;
// offers and contact details are live facts too: get_deals / get_store_info own them, never a document
const OFFER = /\b\d{1,3}\s?%\s?(off|discount)|\b(all|every|your) orders? (are|is) free|free (food|orders?|meals?) for (all|everyone)|\bdiscount code\s+\S+/gi;
const PHONE = /\+?\d[\d\s-]{8,}\d/g;

function cleanPassage(text) {
    const sentences = stripTags(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, ' ').split(/(?<=[.!?۔])\s+|\n+/);
    return sentences
        .filter((s) => !INJECTION.test(s))
        .join(' ')
        .replace(PRICE, '[price: check the menu]')
        .replace(OFFER, "[offers: check today's deals]")
        .replace(PHONE, '[phone: see the Contact page]')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

module.exports = [
    {
        name: 'search_documents',
        description: "The shop's own documents (catering and event guides, policies, services, FAQs written as documents). Use for questions the menu and store tools don't cover. Never use for prices, deals, stock, hours or order status.",
        parameters: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', maxLength: 300 } } },
        maxOutput: 4000,
        async handler({ query }) {
            const { passages } = await retrieve(query);
            if (!passages.length) return { data: { passages: [], note: "No document covers this. Say you don't know and suggest the Contact page." } };
            const out = passages
                .map((p) => ({ source: cleanTitle(p.source), section: cleanTitle(p.heading), text: cleanPassage(p.text) }))
                .filter((p) => p.text.length > 20);
            if (!out.length) return { data: { passages: [], note: "No document covers this. Say you don't know and suggest the Contact page." } };
            const seen = new Set();
            const cards = out
                .filter((p) => (seen.has(`${p.source}|${p.section}`) ? false : seen.add(`${p.source}|${p.section}`)))
                .map((p) => ({ type: 'source', id: `${p.source}|${p.section}`, title: p.source, section: p.section }));
            return {
                data: { passages: out.map((p) => ({ source: p.source, section: p.section, text: `<document source="${p.source}">${p.text}</document>` })) },
                cards,
            };
        },
    },
];

module.exports.cleanPassage = cleanPassage;
