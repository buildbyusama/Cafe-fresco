// Recommendations from our own data only (A10): orders, cart and view events, categories, tags, embeddings.
// Every list: active + in-stock dishes, at most 2 per category, 8 items, deterministic order, cached 5 min.
const mongoose = require('mongoose');
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const Order = require('../models/order');
const UserEvent = require('../models/userEvent');
const { cosine } = require('./ai/embeddings');

const LIMIT = 8;
const PER_CATEGORY = 2;
const DAY = 24 * 60 * 60 * 1000;
const WEIGHT = { purchase: 3, add_to_cart: 2, view: 0.5, chat_reco_click: 1 };

// ---------- cache ----------
const cache = new Map();
const TTL = 5 * 60 * 1000;
async function cached(key, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.value;
    const value = await fn();
    cache.set(key, { value, at: Date.now() });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return value;
}
const bust = () => cache.clear();

// ---------- building blocks ----------
const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Shop-visible, in-stock dishes keyed by id (with the fields the scorers need)
async function catalog({ withVectors = false } = {}) {
    const stocked = await Inventory.find({ quantityInStock: { $gt: 0 } }).select('productId').lean();
    const q = Product.find({ isActive: { $ne: false }, _id: { $in: stocked.map((s) => s.productId) } }).select('title category tags featured averageRating reviewCount createdAt');
    if (withVectors) q.select('+embedding');
    return new Map((await q.lean()).map((p) => [String(p._id), p]));
}

// Highest score first; ties by id so the same input gives the same list
const ranked = (scores) => [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);

// Keep at most PER_CATEGORY per category, then fill from the rest if the list is short
function diversify(ids, items, limit = LIMIT) {
    const perCat = new Map();
    const picked = [];
    const skipped = [];
    for (const id of ids) {
        const cat = String(items.get(id)?.category || '');
        if ((perCat.get(cat) || 0) < PER_CATEGORY) {
            picked.push(id);
            perCat.set(cat, (perCat.get(cat) || 0) + 1);
        } else skipped.push(id);
        if (picked.length === limit) return picked;
    }
    return [...picked, ...skipped].slice(0, limit);
}

// Fallback order when there is no behaviour data: featured, then best-rated, then longest on the menu
const fallbackOrder = (items) =>
    [...items.values()]
        .sort((a, b) => (b.featured === true) - (a.featured === true) || (b.averageRating || 0) - (a.averageRating || 0) || new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id)))
        .map((p) => String(p._id));

const decay = (at, now) => Math.pow(0.5, (now - new Date(at).getTime()) / (3 * DAY)); // half-life 3 days

// ---------- scorers ----------

// Trending: weighted, time-decayed purchases / add-to-carts / views in the window
async function trendingIds({ days = 7, items } = {}) {
    const now = Date.now();
    // scored in the database: weight × quantity (views count 1, others capped at 10) × 0.5^(age / 3 days)
    const weight = { $switch: { branches: Object.entries(WEIGHT).map(([k, w]) => ({ case: { $eq: ['$type', k] }, then: w })), default: 0 } };
    const qty = { $cond: [{ $eq: ['$type', 'view'] }, 1, { $min: [{ $ifNull: ['$quantity', 1] }, 10] }] };
    const age = { $divide: [{ $subtract: [new Date(now), '$at'] }, 3 * DAY] };
    const rows = await UserEvent.aggregate([
        { $match: { type: { $in: Object.keys(WEIGHT) }, productId: { $ne: null }, at: { $gte: new Date(now - days * DAY) } } },
        { $group: { _id: '$productId', score: { $sum: { $multiply: [weight, qty, { $pow: [0.5, age] }] } } } },
    ]);
    const scores = new Map();
    for (const r of rows) {
        const id = String(r._id);
        if (items.has(id)) scores.set(id, r.score);
    }
    const hot = ranked(scores);
    return [...hot, ...fallbackOrder(items).filter((id) => !scores.has(id))];
}

async function trending({ days = 7 } = {}) {
    return cached(`trending:${days}`, async () => {
        const items = await catalog();
        return diversify(await trendingIds({ days, items }), items);
    });
}

// For a person: category + tag affinity from their last 50 events, plus embedding similarity to their
// top dishes; anything bought in the last 24 h is left out. No history → trending.
async function forUser({ userId, anonId }) {
    const who = userId ? { userId: oid(userId) } : anonId ? { anonId } : null;
    if (!who) return { ids: await trending(), personal: false };
    return cached(`user:${userId || anonId}`, async () => {
        const history = await UserEvent.find({ ...who, productId: { $ne: null } }).sort({ at: -1 }).limit(50).select('type productId quantity at').lean();
        if (!history.length) return { ids: await trending(), personal: false };

        const items = await catalog({ withVectors: true });
        const seenProducts = await Product.find({ _id: { $in: [...new Set(history.map((e) => String(e.productId)))] } }).select('category tags +embedding').lean();
        const byId = new Map(seenProducts.map((p) => [String(p._id), p]));
        const now = Date.now();
        const catAff = new Map();
        const tagAff = new Map();
        const interest = new Map();
        for (const e of history) {
            const p = byId.get(String(e.productId));
            if (!p) continue;
            const w = (WEIGHT[e.type] || 0.5) * decay(e.at, now);
            interest.set(String(p._id), (interest.get(String(p._id)) || 0) + w);
            catAff.set(String(p.category), (catAff.get(String(p.category)) || 0) + w);
            for (const t of p.tags || []) tagAff.set(t, (tagAff.get(t) || 0) + w);
        }
        const norm = (m) => { const max = Math.max(1e-9, ...m.values()); return (k) => (m.get(k) || 0) / max; };
        const cat = norm(catAff);
        const tag = norm(tagAff);
        const topVecs = ranked(interest).slice(0, 3).map((id) => byId.get(id)?.embedding).filter((v) => v?.length);
        const boughtRecently = new Set(history.filter((e) => e.type === 'purchase' && now - new Date(e.at).getTime() < DAY).map((e) => String(e.productId)));

        const scores = new Map();
        const why = new Map(); // the strongest signal behind each pick, for the "why this?" line
        for (const [id, p] of items) {
            if (boughtRecently.has(id)) continue;
            const bestTag = (p.tags || []).reduce((best, t) => (tag(t) > (best ? tag(best) : 0) ? t : best), null);
            const tagScore = bestTag ? tag(bestTag) : 0;
            const sim = topVecs.length && p.embedding?.length ? Math.max(...topVecs.map((v) => cosine(v, p.embedding))) : 0;
            const parts = { category: 0.45 * cat(String(p.category)), tag: 0.3 * tagScore, similar: 0.25 * sim };
            scores.set(id, parts.category + parts.tag + parts.similar + 0.001 * (p.averageRating || 0));
            const top = Object.entries(parts).sort((a, b) => b[1] - a[1])[0][0];
            why.set(id, top === 'tag' && bestTag ? { kind: 'tag', value: bestTag } : top === 'similar' && sim > 0 ? { kind: 'similar' } : { kind: 'category', value: String(p.category) });
        }
        const ids = diversify(ranked(scores), items);
        const catTitles = new Map((await mongoose.model('category').find({ _id: { $in: ids.map((id) => items.get(id).category) } }).select('title').lean()).map((c) => [String(c._id), c.title]));
        const reasons = Object.fromEntries(ids.map((id) => {
            const w = why.get(id);
            const text = w.kind === 'tag' ? `Because you like #${w.value}` : w.kind === 'similar' ? 'Similar to dishes you viewed' : `Because you like ${catTitles.get(w.value) || 'this kind of dish'}`;
            return [id, text];
        }));
        return { ids, personal: true, reasons };
    });
}

// Similar: same category, shared tags, embedding similarity; never the dish itself
async function similar(productId) {
    return cached(`similar:${productId}`, async () => {
        const base = await Product.findById(productId).select('category tags +embedding').lean();
        if (!base) return null;
        const items = await catalog({ withVectors: true });
        const scores = new Map();
        for (const [id, p] of items) {
            if (id === String(productId)) continue;
            const shared = (p.tags || []).filter((t) => (base.tags || []).includes(t)).length;
            const sim = base.embedding?.length && p.embedding?.length ? cosine(base.embedding, p.embedding) : 0;
            const score = (String(p.category) === String(base.category) ? 0.5 : 0) + Math.min(shared, 3) * 0.1 + 0.4 * sim;
            if (score > 0) scores.set(id, score);
        }
        // similar dishes may share a category, so allow more of the same one here
        return ranked(scores).slice(0, LIMIT);
    });
}

const COMPLEMENT = /drink|beverage|juice|shake|smoothie|coffee|tea|dessert|sweet|cake/i;

// Goes well with the cart: bought together in completed orders (90 days), then drinks/desserts the cart lacks
async function withCart(productIds) {
    const inCart = [...new Set(productIds.map(String))];
    return cached(`cart:${inCart.sort().join(',')}`, async () => {
        const items = await catalog();
        const scores = new Map();
        if (inCart.length) {
            const orders = await Order.find({ orderStatus: 'completed', createdAt: { $gte: new Date(Date.now() - 90 * DAY) }, 'products.productId': { $in: inCart.map(oid) } })
                .select('products.productId')
                .limit(500)
                .lean();
            for (const o of orders) for (const l of o.products) {
                const id = String(l.productId);
                if (!inCart.includes(id) && items.has(id)) scores.set(id, (scores.get(id) || 0) + 1);
            }
        }
        const cartCats = new Set((await Product.find({ _id: { $in: inCart } }).select('category').lean()).map((p) => String(p.category)));
        const catTitles = new Map((await mongoose.model('category').find({ _id: { $in: [...new Set([...items.values()].map((p) => p.category))] } }).select('title').lean()).map((c) => [String(c._id), c.title]));
        const fallback = fallbackOrder(items);
        for (const [rank, id] of fallback.entries()) {
            if (inCart.includes(id) || scores.has(id)) continue;
            const p = items.get(id);
            const complements = COMPLEMENT.test(catTitles.get(String(p.category)) || '') && !cartCats.has(String(p.category));
            if (complements) scores.set(id, 0.5 - rank * 1e-4); // below any real co-purchase signal
        }
        const ids = ranked(scores);
        const rest = fallback.filter((id) => !inCart.includes(id) && !scores.has(id));
        return diversify([...ids, ...rest], items);
    });
}

// ids → full product documents in the given order (category populated)
async function hydrate(ids) {
    const docs = await Product.find({ _id: { $in: ids } }).populate('category', 'title').lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

module.exports = { trending, forUser, similar, withCart, hydrate, bust, diversify, LIMIT };
