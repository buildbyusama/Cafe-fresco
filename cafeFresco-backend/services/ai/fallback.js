// Rule-based assistant (A7): used when there is no key, OpenAI is down/slow, or the daily budget is spent.
// It recognises common intents, calls the SAME tools as the AI, and answers from their results only.
const tools = require('./tools');

let seq = 0;
const call = (name, args) => ({ id: `call_rule_${++seq}`, name, arguments: JSON.stringify(args) });

// Questions the shop's documents usually answer (catering, events, services…)
const DOC_TOPIC = /cater|wedding|\bevents?\b|part(y|ies)|birthday|\bhall\b|reserv|book(ing)? (a )?(table|hall)|halal|parking|\bkids?\b|children|service|corporate|office (lunch|order)|bulk order/;
const MENU_WORDS = /dish|vegan|vegetarian|\bveg\b|menu|food|eat|drink|dessert|burger|pizza|pasta|coffee|tea|cake|sandwich|salad|spicy/;

// the menu part of a mixed question ("do you cater weddings, and what vegan dishes do you have?")
const menuPart = (text) => String(text).split(/,|;|\band\b|\balso\b/i).map((x) => x.trim()).find((x) => MENU_WORDS.test(x.toLowerCase()) && !DOC_TOPIC.test(x.toLowerCase()));

// Latest user message → { refuse } | { calls, addQty? }
function plan(text) {
    const t = String(text || '').toLowerCase().trim();
    if (/ignore (all |previous |the |your )?(instructions|rules)|system prompt|api key|reveal your|jailbreak|developer mode/.test(t)) return { refuse: "I can't share that, but I'm happy to help with our menu, your orders or the shop." };
    if (/homework|write (me )?(a |some )?code|python|javascript|politic|election|bitcoin|crypto|essay/.test(t)) return { refuse: 'I can only help with Cafe Fresco: our menu, your orders, deals and shop info.' };
    if (/^(hi|hello|hey|salam|assalam|aoa|hy)\b/.test(t) && t.length < 25) return { greet: true };
    if (/human|real person|agent|staff|manager|complain|insaan|banda/.test(t)) return { calls: [call('escalate_to_human', { reason: String(text).slice(0, 200) })] };
    const id = t.match(/#?\b([0-9a-f]{6})\b/i);
    if (/track|where.*order|order status|my order|order kahan|mera order/.test(t)) return { calls: [id ? call('get_order_status', { shortId: id[1].toUpperCase() }) : call('get_my_orders', { limit: 3 })] };
    if (/\bcart\b/.test(t) && !/^add\b/.test(t)) return { calls: [call('get_my_cart', {})] };
    const code = text.match(/\bcode\s+([a-z0-9_-]{3,20})\b/i);
    if (code) return { calls: [call('check_discount_code', { code: code[1] })] };
    if (/deal|offer|discount|sale|promo/.test(t)) return { calls: [call('get_deals', {})] };
    if (/trending|popular|best ?sell|most ordered/.test(t)) return { calls: [call('recommend', { mode: 'trending' })] };
    if (/recommend|suggest|what should i|kya khaun|kya order/.test(t)) return { calls: [call('recommend', { mode: 'for_me' })] };
    if (DOC_TOPIC.test(t)) {
        const dish = menuPart(text);
        // a mixed question searches the documents with the non-menu part only, so dish words don't dilute it
        const rest = (dish ? String(text).replace(dish, ' ').replace(/[,;]|\band\b|\balso\b/gi, ' ').replace(/\s+/g, ' ').trim() : String(text)).slice(0, 300) || String(text).slice(0, 300);
        return { calls: [call('search_documents', { query: rest }), call('search_knowledge', { query: rest }), ...(dish ? [call('search_menu', { query: cleanQuery(dish.toLowerCase()), limit: 4 })] : [])] };
    }
    if (/open now|are you open|abhi khula/.test(t)) return { calls: [call('get_store_info', { topic: 'open_now' })] };
    if (/hour|timing|close|open|time/.test(t)) return { calls: [call('get_store_info', { topic: 'hours' })] };
    if (/deliver/.test(t)) return { calls: [call('get_store_info', { topic: 'delivery' })] };
    if (/contact|phone|email|address|location|where are you/.test(t)) return { calls: [call('get_store_info', { topic: 'contact' })] };
    if (/\bpay|cash|card\b/.test(t)) return { calls: [call('get_store_info', { topic: 'payments' })] };
    if (/cancel|refund|policy/.test(t)) return { calls: [call('get_store_info', { topic: 'policies' }), call('search_documents', { query: String(text).slice(0, 300) })] };
    if (/categor|what do you (have|serve)|^menu$|full menu/.test(t)) return { calls: [call('list_categories', {})] };
    const add = t.match(/^add\s+(\d+)?\s*(?:x\s*)?(.+?)(\s+to (my )?cart)?$/);
    if (add) return { calls: [call('search_menu', { query: add[2], limit: 1 })], addQty: Math.min(10, Number(add[1] || 1)) };
    const under = t.match(/(?:under|below|less than|within)\s*\$?\s*(\d+(\.\d+)?)/);
    const query = cleanQuery(t);
    if (query.length >= 2 || under) return { calls: [call('search_menu', { ...(query ? { query } : {}), ...(under ? { maxPrice: Number(under[1]) } : {}), limit: 4 })] };
    return { calls: [call('search_knowledge', { query: text }), call('search_documents', { query: String(text).slice(0, 300) })] };
}

function cleanQuery(t) {
    return t
        .replace(/(?:under|below|less than|within)\s*\$?\s*\d+(\.\d+)?\s*(dollars?|usd|rs|rupees)?/, '')
        .replace(/^(show me|i want|i'd like|do you have|any|find|give me|looking for|what)\s+/, '')
        .replace(/\s+do you have$/, '')
        .replace(/[?!.]+$/, '')
        .trim();
}

// the best passage, quoted briefly with its source (prices were already replaced by the tool)
function quote(data) {
    const p = data?.passages?.[0];
    if (!p) return null;
    const text = String(p.text).replace(/<\/?document[^>]*>/g, '').trim();
    let out = '';
    for (const sentence of text.split(/(?<=[.!?۔])\s+/)) {
        if (out && out.length + sentence.length > 400) break;
        out += (out ? ' ' : '') + sentence;
    }
    return `${out.slice(0, 450)} (from ${p.source})`;
}

const money = (n) => `$${Number(n).toFixed(2)}`;

// Text answer from tool results only (the same rule the AI must follow)
function answer(results) {
    const parts = [];
    const docs = results.filter((r) => r.name === 'search_documents').map((r) => quote(r.data)).filter(Boolean);
    const menu = results.find((r) => r.name === 'search_menu')?.data;
    const noExactDish = menu && (menu.closestOnly || !menu.items?.length);
    for (const { name, data } of results) {
        if (name === 'search_documents') continue; // added below
        if (docs.length && name === 'search_knowledge' && !data?.entries?.length) continue; // a document answered it
        if (docs.length && name === 'search_menu' && !data?.items?.length) continue;
        if (data?.error === 'login_required') { parts.push('Please log in so I can check your account.'); continue; }
        if (data?.error) { parts.push(data.message || "I couldn't find that."); continue; }
        if (['search_menu', 'get_deals', 'recommend'].includes(name)) {
            const items = data.items || [];
            const lead = data.closestOnly ? "I couldn't find exactly that on our menu. The closest dishes we have:" : "Here's what I found:";
            parts.push(items.length ? `${lead}\n${items.map((i) => `- **${i.title}** — ${money(i.finalPrice)}${i.inStock ? '' : ' (out of stock)'}`).join('\n')}` : "I couldn't find a matching dish on our menu. Try another word, or browse the full menu.");
        } else if (name === 'get_dish') {
            parts.push(`**${data.title}** — ${money(data.finalPrice)}. ${data.description || ''}`.trim());
        } else if (name === 'list_categories') {
            parts.push(`We serve: ${(data.categories || []).map((c) => c.title).join(', ')}.`);
        } else if (name === 'get_my_orders' || name === 'get_order_status') {
            const orders = data.orders || [];
            parts.push(orders.length ? orders.map((o) => `Order **#${o.shortId}** is **${o.status}** (${o.payment}), total ${money(o.total)}.`).join('\n') : data.message || "I couldn't find that order on your account.");
        } else if (name === 'get_my_cart') {
            parts.push(data.lines?.length ? `Your cart has ${data.lines.length} item(s), subtotal ${money(data.subtotal)}.` : 'Your cart is empty.');
        } else if (name === 'get_store_info') {
            parts.push(data.answer);
        } else if (name === 'search_knowledge') {
            parts.push(data.entries?.length ? data.entries[0].answer : "I don't have an answer to that yet. Please use the Contact page and our team will help.");
        } else if (name === 'check_discount_code') {
            parts.push(data.valid ? `Code **${data.code}** works: you'd save ${money(data.discountAmount)}. Apply it on the cart page.` : data.message);
        } else if (name === 'propose_add_to_cart') {
            parts.push(`Tap **Confirm** to add ${data.quantity} × ${data.title} to your cart.`);
        } else if (name === 'escalate_to_human') {
            parts.push(data.message);
        }
    }
    // database facts first, then documents; but when no dish matched, the document is the real answer
    const all = (noExactDish ? [...docs, ...parts] : [...parts, ...docs]).filter(Boolean);
    if (!all.length && results.some((r) => r.name === 'search_documents')) return "I don't have that information yet. Please use the Contact page and our team will help.";
    return all.join('\n\n') || "Sorry, I couldn't find an answer to that.";
}

const GREETING = "Hi! I can help you find dishes, check today's deals, track your order or answer questions about Cafe Fresco. What would you like?";

// Full rule-based turn: plan → tools → (optional add-to-cart proposal) → templated answer
async function respond(text, ctx) {
    const p = plan(text);
    if (p.refuse) return { content: p.refuse, cards: [], toolRuns: [] };
    if (p.greet) return { content: GREETING, cards: [], toolRuns: [] };
    // store-fact questions ("do you deliver birthday cakes?") may have a more specific staff FAQ answer: ask both
    const calls = p.calls.some((c) => c.name === 'get_store_info') ? [call('search_knowledge', { query: String(text).slice(0, 300) }), ...p.calls] : p.calls;
    let runs = await Promise.all(calls.map((c) => tools.run(c.name, c.arguments, ctx)));
    runs = runs.filter((r) => r.name !== 'search_knowledge' || r.data?.entries?.length || !p.calls.some((c) => c.name === 'get_store_info'));
    runs = runs.filter((r) => r.name !== 'search_documents' || r.data?.passages?.length || !runs.some((x) => x !== r && x.name !== 'search_knowledge' && !x.data?.error));
    const search = runs.find((r) => r.name === 'search_menu');
    const found = search?.data?.items?.[0];
    if (p.addQty && found) runs = [await tools.run('propose_add_to_cart', { productId: found.id, quantity: p.addQty }, ctx)];
    // no dish matched and it may be a general question (parking, events…): try the FAQ before giving up
    // no exact dish: the shop's documents (and FAQ) may answer it (catering, parking, events…)
    else if (search && (!found || search.data?.closestOnly) && !p.addQty && !runs.some((r) => r.name === 'search_documents')) {
        const [faq, docs] = await Promise.all([
            found ? null : tools.run('search_knowledge', { query: String(text).slice(0, 300) }, ctx),
            tools.run('search_documents', { query: String(text).slice(0, 300) }, ctx),
        ]);
        const docHit = docs.data?.passages?.length ? [docs] : [];
        if (found) runs = [...docHit, ...runs];
        else if (faq.data?.entries?.length) runs = [faq, ...docHit];
        else runs = docHit.length ? docHit : [{ name: 'search_knowledge', data: { entries: [] }, cards: [] }];
    }
    return { content: answer(runs.map((r) => ({ name: r.name, data: r.data || JSON.parse(r.content) }))), cards: runs.flatMap((r) => r.cards || []), toolRuns: runs };
}

module.exports = { plan, answer, respond, GREETING };
