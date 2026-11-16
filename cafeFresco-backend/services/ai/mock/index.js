// Offline stand-in for OpenAI (A8). Same shapes as the real client; answers are built only from
// tool results, so tests exercise the real tools and grounding without the key or any cost.
const crypto = require('crypto');

const DIM = 256;
const words = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
// light stemming so "pancakes" matches "pancake"
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');

// Deterministic bag-of-words vector: cosine ≈ word overlap
function embed(text) {
    const v = new Array(DIM).fill(0);
    for (const w of words(text)) {
        const h = crypto.createHash('md5').update(stem(w)).digest();
        v[h.readUInt16BE(0) % DIM] += 1;
    }
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
}

const flagged = (text) => /\b(kill|bomb|suicide)\b/i.test(String(text));

const tokens = (s) => Math.ceil(String(s || '').length / 4);
let seq = 0;
const call = (name, args) => ({ id: `call_mock_${++seq}`, name, arguments: JSON.stringify(args) });

// What the "model" asks for, from the latest user message
function plan(text) {
    const t = text.toLowerCase();
    if (/ignore (all |previous |the )?(instructions|rules)|system prompt|api key|reveal your/.test(t)) return { refuse: "I can't share that, but I'm happy to help with our menu, your orders or the shop." };
    if (/homework|write (me )?code|python|politic|election|bitcoin/.test(t)) return { refuse: "I can only help with Cafe Fresco: our menu, your orders, deals and shop info." };
    if (/human|real person|agent|staff|complain/.test(t)) return { calls: [call('escalate_to_human', { reason: text.slice(0, 200) })] };
    const id = t.match(/#?\b([0-9a-f]{6})\b/i);
    if (/track|where.*order|order status|my order/.test(t)) return { calls: [id ? call('get_order_status', { shortId: id[1].toUpperCase() }) : call('get_my_orders', { limit: 3 })] };
    if (/\bcart\b/.test(t) && !/^add/.test(t)) return { calls: [call('get_my_cart', {})] };
    if (/code\s+([a-z0-9_-]{3,20})/i.test(text)) return { calls: [call('check_discount_code', { code: text.match(/code\s+([a-z0-9_-]{3,20})/i)[1] })] };
    if (/deal|offer|discount|sale/.test(t)) return { calls: [call('get_deals', {})] };
    if (/trending|popular|best ?sell/.test(t)) return { calls: [call('recommend', { mode: 'trending' })] };
    if (/recommend|suggest|what should i/.test(t)) return { calls: [call('recommend', { mode: 'for_me' })] };
    if (/open now|are you open/.test(t)) return { calls: [call('get_store_info', { topic: 'open_now' })] };
    if (/hour|timing|close|open/.test(t)) return { calls: [call('get_store_info', { topic: 'hours' })] };
    if (/deliver/.test(t)) return { calls: [call('get_store_info', { topic: 'delivery' })] };
    if (/contact|phone|email|address|location/.test(t)) return { calls: [call('get_store_info', { topic: 'contact' })] };
    if (/pay|cash|card/.test(t)) return { calls: [call('get_store_info', { topic: 'payments' })] };
    if (/cancel|refund|policy/.test(t)) return { calls: [call('search_knowledge', { query: text }), call('get_store_info', { topic: 'policies' })] };
    if (/categor|what do you (have|serve)|menu$/.test(t)) return { calls: [call('list_categories', {})] };
    const add = t.match(/^add\s+(\d+)?\s*(.+?)(\s+to (my )?cart)?$/);
    if (add) return { calls: [call('search_menu', { query: add[2], limit: 1 })], addQty: Number(add[1] || 1) };
    const under = t.match(/under\s*\$?\s*(\d+(\.\d+)?)/);
    const query = t.replace(/under\s*\$?\s*\d+(\.\d+)?\s*(dollars?|usd|rs)?/, '').replace(/^(show me|i want|do you have|any|find)\s+/, '').trim();
    return { calls: [call('search_menu', { ...(query ? { query } : {}), ...(under ? { maxPrice: Number(under[1]) } : {}), limit: 4 })] };
}

const money = (n) => `$${Number(n).toFixed(2)}`;

// Text answer built only from tool results (what a grounded model would say)
function answer(results) {
    const parts = [];
    for (const { name, data } of results) {
        if (data?.error === 'login_required') { parts.push('Please log in so I can look at your account.'); continue; }
        if (data?.error) { parts.push(data.message || "I couldn't find that."); continue; }
        if (name === 'search_menu' || name === 'get_deals' || name === 'recommend') {
            const items = data.items || [];
            parts.push(items.length ? `Here's what I found:\n${items.map((i) => `- **${i.title}** — ${money(i.finalPrice)}${i.inStock ? '' : ' (out of stock)'}`).join('\n')}` : "I couldn't find a matching dish on our menu.");
        } else if (name === 'list_categories') {
            parts.push(`We serve: ${(data.categories || []).map((c) => c.title).join(', ')}.`);
        } else if (name === 'get_my_orders' || name === 'get_order_status') {
            const orders = data.orders || [];
            parts.push(orders.length ? orders.map((o) => `Order #${o.shortId} is **${o.status}** (${o.payment}), total ${money(o.total)}.`).join('\n') : "I couldn't find that order on your account.");
        } else if (name === 'get_my_cart') {
            parts.push(data.lines?.length ? `Your cart has ${data.lines.length} item(s), subtotal ${money(data.subtotal)}.` : 'Your cart is empty.');
        } else if (name === 'get_store_info') {
            parts.push(data.answer || "I don't have that information yet. Please check the Contact page.");
        } else if (name === 'search_knowledge') {
            if (data.entries?.length) parts.push(data.entries[0].answer);
        } else if (name === 'check_discount_code') {
            parts.push(data.valid ? `Code ${data.code} works: you'd save ${money(data.discountAmount)}.` : data.message);
        } else if (name === 'propose_add_to_cart') {
            parts.push(`Tap **Confirm** to add ${data.quantity} × ${data.title} to your cart.`);
        } else if (name === 'escalate_to_human') {
            parts.push(data.message);
        }
    }
    return parts.filter(Boolean).join('\n\n') || "Sorry, I couldn't find an answer to that.";
}

// "why this?" reasons: friendlier wording of each hint, plus an id we were NOT given (the caller must drop it)
function reasons(messages) {
    const { dishes = [] } = safeJson(messages[messages.length - 1].content);
    const out = { mock_extra_id: 'Free dessert for you' };
    for (const d of dishes) out[d.id] = d.hint.replace(/^Because you like/, 'You enjoy');
    return JSON.stringify({ reasons: out });
}

async function chat({ messages, onDelta }) {
    const inTokens = messages.reduce((n, m) => n + tokens(m.content), 0);
    if (/^You write very short reasons/.test(messages[0]?.content || '')) {
        const content = reasons(messages);
        return { content, toolCalls: [], usage: { in: inTokens, out: tokens(content) } };
    }
    const last = messages[messages.length - 1];
    let content = '';
    let toolCalls = [];

    if (last.role === 'tool') {
        // collect this round's tool results (they follow the last assistant message)
        let i = messages.length - 1;
        const results = [];
        while (i >= 0 && messages[i].role === 'tool') {
            results.unshift({ name: messages[i].name, data: safeJson(messages[i].content) });
            i--;
        }
        const userText = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
        const p = plan(userText);
        const found = results.find((r) => r.name === 'search_menu')?.data?.items?.[0];
        if (p.addQty && found && !results.some((r) => r.name === 'propose_add_to_cart')) {
            toolCalls = [call('propose_add_to_cart', { productId: found.id, quantity: p.addQty })];
        } else {
            content = answer(results);
        }
    } else {
        const p = plan(last.content || '');
        if (p.refuse) content = p.refuse;
        else toolCalls = p.calls;
    }

    // stream in small chunks like the real API
    for (const piece of content.match(/.{1,12}/gs) || []) onDelta?.(piece);
    return { content, toolCalls, usage: { in: inTokens, out: tokens(content) + toolCalls.length * 20 } };
}

function safeJson(s) {
    try { return JSON.parse(s); } catch { return {}; }
}

module.exports = { chat, embed, flagged, DIM };
