// Product embeddings and hybrid (semantic + keyword) menu search. The menu is small (< 1k dishes),
// so vectors are cosine-ranked in memory; the cache is rebuilt after any product change.
const crypto = require('crypto');
const Product = require('../../models/product');
const Inventory = require('../../models/inventory');
const { embed, AiError } = require('./client');
const { escapeRegex } = require('../../utils/validation');

const DIET_WORDS = (d = {}) => [d.vegan && 'vegan', d.vegetarian && 'vegetarian', d.spicyLevel > 0 && ['', 'mild spicy', 'medium spicy', 'hot spicy'][d.spicyLevel]].filter(Boolean);

// What a dish "means" for search: title, category, tags, diet words and the start of the description
function textFor(p) {
    return [p.title, p.category?.title, (p.tags || []).join(', '), DIET_WORDS(p.dietary).join(', '), String(p.description || '').slice(0, 600)].filter(Boolean).join('. ');
}
const hashOf = (text) => crypto.createHash('sha1').update(text).digest('hex');

// ---- keeping vectors up to date ----

// Re-embed only dishes whose text changed. Returns { embedded, skipped }.
async function embedProducts(ids) {
    const filter = ids ? { _id: { $in: ids } } : {};
    const products = await Product.find(filter).select('+embeddingHash title description tags dietary category').populate('category', 'title').lean();
    const todo = products.map((p) => ({ p, text: textFor(p) })).filter(({ p, text }) => p.embeddingHash !== hashOf(text));
    for (let i = 0; i < todo.length; i += 64) {
        const batch = todo.slice(i, i + 64);
        const vectors = await embed(batch.map((x) => x.text));
        await Product.bulkWrite(batch.map(({ p, text }, j) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { embedding: vectors[j], embeddingHash: hashOf(text) } } } })));
    }
    if (todo.length) bust();
    return { embedded: todo.length, skipped: products.length - todo.length };
}

// After a save: wait 2 s (several quick saves become one call), never block the request
const pending = new Set();
let timer = null;
function scheduleEmbed(id) {
    bust();
    pending.add(String(id));
    clearTimeout(timer);
    timer = setTimeout(() => {
        const ids = [...pending];
        pending.clear();
        embedProducts(ids).catch((err) => {
            // no key / over budget is normal: the next save or scripts/embedProducts.js catches up
            if (!(err instanceof AiError && ['disabled', 'budget'].includes(err.code))) console.error('Embedding update failed:', err.message);
        });
    }, 2000);
    timer.unref?.();
}

// ---- search ----

let vectors = null; // [{ id, vec }] for active dishes
let vectorsAt = 0;
const VECTOR_TTL = 5 * 60 * 1000;
function bust() { vectors = null; }

async function loadVectors() {
    if (vectors && Date.now() - vectorsAt < VECTOR_TTL) return vectors;
    const rows = await Product.find({ isActive: { $ne: false }, 'embedding.0': { $exists: true } }).select('+embedding').lean();
    vectors = rows.map((r) => ({ id: String(r._id), vec: r.embedding }));
    vectorsAt = Date.now();
    return vectors;
}

// query → vector, cached (each uncached query costs money)
const queryCache = new Map();
async function queryVector(q) {
    const key = q.toLowerCase();
    const hit = queryCache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.vec;
    const [vec] = await embed([q]);
    queryCache.set(key, { vec, at: Date.now() });
    if (queryCache.size > 500) queryCache.delete(queryCache.keys().next().value);
    return vec;
}

const cosine = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

// Mongo filter for the structured parts (shared with the assistant's search_menu tool)
function structuredFilter({ category, minPrice, maxPrice, tags, diet } = {}) {
    const filter = { isActive: { $ne: false } };
    if (category) filter.category = category;
    if (tags?.length) filter.tags = { $all: tags.map((t) => String(t).toLowerCase()) };
    if (diet === 'vegan') filter['dietary.vegan'] = true;
    if (diet === 'vegetarian') filter['dietary.vegetarian'] = true;
    if (minPrice != null || maxPrice != null) {
        const final = { $round: [{ $multiply: ['$price', { $subtract: [1, { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] }] }, 2] };
        filter.$expr = { $and: [...(minPrice != null ? [{ $gte: [final, Number(minPrice)] }] : []), ...(maxPrice != null ? [{ $lte: [final, Number(maxPrice)] }] : [])] };
    }
    return filter;
}

const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);

/**
 * Hybrid search: 0.7 × cosine + 0.3 × keyword overlap, in-stock dishes only.
 * Falls back to keyword (regex) search when AI is off or over budget. → { products, mode }
 */
async function semanticSearch(query, { limit = 8, inStockOnly = true, ...filters } = {}) {
    const q = String(query || '').trim().slice(0, 200);
    const filter = structuredFilter(filters);
    if (inStockOnly) {
        const stocked = await Inventory.find({ quantityInStock: { $gt: 0 } }).select('productId').lean();
        filter._id = { $in: stocked.map((s) => s.productId) };
    }
    const candidates = await Product.find(filter).populate('category', 'title').lean();
    if (!q) return { products: candidates.slice(0, limit), mode: 'filter' };

    const qWords = words(q);
    const keyword = (p) => {
        const hay = words(textFor(p));
        return qWords.length ? qWords.filter((w) => hay.some((h) => h.startsWith(w) || w.startsWith(h))).length / qWords.length : 0;
    };

    let qvec = null;
    try {
        qvec = await queryVector(q);
    } catch (err) {
        if (!(err instanceof AiError)) throw err;
    }
    if (!qvec) {
        // keyword fallback: title/description/tags contain the words
        const rx = new RegExp(qWords.map(escapeRegex).join('|') || escapeRegex(q), 'i');
        const hits = candidates.filter((p) => rx.test(textFor(p))).sort((a, b) => keyword(b) - keyword(a));
        return { products: hits.slice(0, limit), mode: 'keyword' };
    }
    const byId = new Map((await loadVectors()).map((v) => [v.id, v.vec]));
    const scored = candidates
        .map((p) => {
            const vec = byId.get(String(p._id));
            const k = keyword(p);
            return { p, score: (vec ? 0.7 * cosine(qvec, vec) : 0) + 0.3 * k, k, sem: vec ? cosine(qvec, vec) : 0 };
        })
        // drop weak matches so "pizza" doesn't return every dish
        .filter((s) => s.k > 0 || s.sem >= 0.25)
        .sort((a, b) => b.score - a.score || String(a.p._id).localeCompare(String(b.p._id)));
    return { products: scored.slice(0, limit).map((s) => s.p), mode: 'semantic' };
}

module.exports = { textFor, embedProducts, scheduleEmbed, semanticSearch, structuredFilter, bust, cosine };
