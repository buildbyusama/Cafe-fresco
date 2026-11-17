// Offline stand-in for OpenAI (A8). Same shapes as the real client. It "decides" with the production
// fallback's intent rules and answers only from tool results, so tests exercise the real tools and grounding.
const crypto = require('crypto');

const DIM = 256;
const words = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
// light stemming so "pancakes" matches "pancake"
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');

// Deterministic bag-of-words vector: cosine ≈ word overlap
function embed(text, dims = DIM) {
    const v = new Array(dims).fill(0);
    for (const w of words(text)) {
        const h = crypto.createHash('md5').update(stem(w)).digest();
        v[h.readUInt16BE(0) % dims] += 1;
    }
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
}

const flagged = (text) => /\b(kill|bomb|suicide)\b/i.test(String(text));
const tokens = (s) => Math.ceil(String(s || '').length / 4);

function safeJson(s) {
    try { return JSON.parse(s); } catch { return {}; }
}

// "why this?" reasons: friendlier wording of each hint, plus an id we were NOT given (the caller must drop it)
function reasons(messages) {
    const { dishes = [] } = safeJson(messages[messages.length - 1].content);
    const out = { mock_extra_id: 'Free dessert for you' };
    for (const d of dishes) out[d.id] = d.hint.replace(/^Because you like/, 'You enjoy');
    return JSON.stringify({ reasons: out });
}

async function chat({ messages, tools, onDelta }) {
    const { plan, answer } = require('../fallback'); // lazy: fallback → tools → client → mock
    const inTokens = messages.reduce((n, m) => n + tokens(m.content), 0);
    const system = messages[0]?.role === 'system' ? messages[0].content : '';
    if (/^You write very short reasons/.test(system)) {
        const content = reasons(messages);
        return { content, toolCalls: [], usage: { in: inTokens, out: tokens(content) } };
    }
    if (/^Summarise this conversation/.test(system)) {
        const content = 'Earlier: the customer asked about the menu.';
        return { content, toolCalls: [], usage: { in: inTokens, out: tokens(content) } };
    }

    const last = messages[messages.length - 1];
    let content = '';
    let toolCalls = [];
    // test hook: a message containing "LOOP_FOREVER" makes the mock keep asking for tools
    const userText = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    if (tools?.length && /LOOP_FOREVER/.test(userText)) {
        toolCalls = [{ id: `call_loop_${Date.now()}_${Math.random()}`, name: 'list_categories', arguments: '{}' }];
    } else if (last.role === 'tool') {
        // this round's tool results follow the last assistant message
        let i = messages.length - 1;
        const results = [];
        while (i >= 0 && messages[i].role === 'tool') {
            results.unshift({ name: messages[i].name, data: safeJson(messages[i].content) });
            i--;
        }
        const p = plan(userText);
        const found = results.find((r) => r.name === 'search_menu')?.data?.items?.[0];
        if (p.addQty && found && !results.some((r) => r.name === 'propose_add_to_cart')) {
            toolCalls = [{ id: `call_mock_add_${Date.now()}`, name: 'propose_add_to_cart', arguments: JSON.stringify({ productId: found.id, quantity: p.addQty }) }];
        } else content = answer(results);
    } else if (!tools?.length) {
        content = 'Here is what I can tell you based on what I found.';
    } else {
        const p = plan(last.content || '');
        if (p.refuse) content = p.refuse;
        else if (p.greet) content = require('../fallback').GREETING;
        else toolCalls = p.calls;
    }
    // reply language follows the system prompt (A11), so tests can see it was passed through
    const lang = system.match(/Reply in (Urdu script|Roman Urdu)/)?.[1];
    if (content && lang) content = `[${lang === 'Urdu script' ? 'ur' : 'roman-ur'}] ${content}`;

    for (const piece of content.match(/.{1,12}/gs) || []) onDelta?.(piece);
    return { content, toolCalls, usage: { in: inTokens, out: tokens(content) + toolCalls.length * 20 } };
}

module.exports = { chat, embed, flagged, DIM };
