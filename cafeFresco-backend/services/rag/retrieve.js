// Find the best passages of published documents for a question (docs/RAG_PLAN.md R2.2).
// Hybrid: 0.75 × cosine + 0.25 × keyword overlap. Vectors live in memory as Float32Array (R10).
const Document = require('../../models/document');
const DocChunk = require('../../models/docChunk');
const { rag } = require('../../config/env');
const { embed, AiError } = require('../ai/client');
const { setOnChange } = require('./documents');

const STOP = new Set(['the', 'and', 'for', 'are', 'you', 'your', 'what', 'which', 'when', 'where', 'how', 'who', 'why', 'does', 'did', 'can', 'could', 'would', 'should', 'with', 'from', 'that', 'this', 'there', 'have', 'has', 'any', 'about', 'tell', 'please', 'want', 'need', 'kya', 'hai', 'hain', 'aap', 'mujhe']);
const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));

// ---- cache: every searchable passage, rebuilt after any document change or after 5 minutes ----
const TTL = 5 * 60 * 1000;
let cache = null;
let cacheAt = 0;
let loading = null;
let generation = 0;
const bust = () => { cache = null; generation++; };
setOnChange(bust);

async function load() {
    if (cache && Date.now() - cacheAt < TTL) return cache;
    if (loading) return loading;
    const gen = generation;
    loading = (async () => {
        // published documents with a processed version; during a replace the previous version keeps serving
        const docs = await Document.find({ isPublished: true, servingVersion: { $gt: 0 }, status: { $in: ['ready', 'processing'] } }).select('title servingVersion').lean();
        const byId = new Map(docs.map((d) => [String(d._id), d]));
        const rows = docs.length
            ? await DocChunk.find({ $or: docs.map((d) => ({ documentId: d._id, version: d.servingVersion })) }).select('+embedding documentId order heading text').lean()
            : [];
        // all vectors in one Float32Array slab (R10): 20,000 × 512 dims ≈ 40 MB, no per-array overhead
        const dims = rows.find((r) => r.embedding?.length)?.embedding.length || 0;
        const slab = new Float32Array(dims * rows.filter((r) => r.embedding?.length === dims).length);
        let at = 0;
        const place = (v) => { const view = slab.subarray(at, at + dims); view.set(unit(v)); at += dims; return view; };
        const passages = rows.map((r) => {
            const doc = byId.get(String(r.documentId));
            return {
                docId: String(r.documentId), source: doc.title, order: r.order, heading: r.heading || '', text: r.text,
                vec: dims && r.embedding?.length === dims ? place(r.embedding) : null, // normalised once: cosine becomes a dot product
                words: wordSet(`${doc.title} ${r.heading || ''} ${r.text}`),
            };
        });
        passages.vectorBytes = slab.byteLength;
        if (gen === generation) { cache = passages; cacheAt = Date.now(); } // a change during loading: don't keep stale data
        return passages;
    })().finally(() => { loading = null; });
    return loading;
}

// question → vector (cached; each uncached question costs a little)
const qCache = new Map();
async function queryVector(q) {
    const key = q.toLowerCase();
    const hit = qCache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.vec;
    const [vec] = await embed([q], { dimensions: rag().dims });
    const f = unit(vec);
    qCache.set(key, { vec: f, at: Date.now() });
    if (qCache.size > 500) qCache.delete(qCache.keys().next().value);
    return f;
}

// unit-length Float32Array (R10: compact, and cosine of unit vectors is a plain dot product)
function unit(v) {
    const f = Float32Array.from(v);
    let n = 0;
    for (let i = 0; i < f.length; i++) n += f[i] * f[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < f.length; i++) f[i] /= n;
    return f;
}
function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}
const cosine = (a, b) => dot(unit(a), unit(b));

// words plus 5-letter stems, so "booking" matches "bookings" without scanning every word
const STEM = 5;
function wordSet(text) {
    const set = new Set();
    for (const w of words(text)) { set.add(w); if (w.length > STEM) set.add(`~${w.slice(0, STEM)}`); }
    return set;
}
const overlap = (qWords, set) => (qWords.length ? qWords.filter((w) => set.has(w) || (w.length >= STEM && set.has(`~${w.slice(0, STEM)}`))).length / qWords.length : 0);

/**
 * retrieve(question) → { passages: [{ source, heading, text, score }], mode: 'semantic'|'keyword'|'none' }
 * At most `perDoc` passages per document, neighbours merged, trimmed to `contextChars` by whole passages.
 */
async function retrieve(question, { limit } = {}) {
    const cfg = rag();
    const max = Math.min(limit || cfg.maxPassages, cfg.maxPassages);
    const q = String(question || '').trim().slice(0, 500);
    const qWords = [...new Set(words(q))];
    if (!q) return { passages: [], mode: 'none' };
    const all = await load();
    if (!all.length) return { passages: [], mode: 'none' };

    let qvec = null;
    try {
        qvec = await queryVector(q);
    } catch (err) {
        if (!(err instanceof AiError)) throw err; // no key / budget / outage → keyword search
    }
    const semantic = Boolean(qvec) && all.some((p) => p.vec);
    let scored;
    if (semantic) {
        scored = [];
        for (const p of all) {
            const k = overlap(qWords, p.words);
            const score = (p.vec ? 0.75 * dot(qvec, p.vec) : 0) + 0.25 * k;
            if (score >= cfg.minScore) scored.push({ p, score });
        }
    } else {
        // stricter without vectors: at least half the meaningful words must appear
        scored = all.map((p) => ({ p, score: overlap(qWords, p.words) })).filter((s) => s.score >= 0.5 && qWords.length);
    }
    scored.sort((a, b) => b.score - a.score || a.p.docId.localeCompare(b.p.docId) || a.p.order - b.p.order);

    // ≤ perDoc per document, best first
    const perDoc = new Map();
    const picked = [];
    for (const s of scored) {
        const n = perDoc.get(s.p.docId) || 0;
        if (n >= cfg.perDoc) continue;
        perDoc.set(s.p.docId, n + 1);
        picked.push(s);
        if (picked.length >= max) break;
    }

    // merge neighbouring passages of the same document (they overlap by design)
    const merged = [];
    for (const s of picked) {
        const twin = merged.find((m) => m.docId === s.p.docId && Math.abs(m.order - s.p.order) === 1);
        if (twin) {
            const [first, second] = twin.order < s.p.order ? [twin, { text: s.p.text }] : [{ text: s.p.text }, twin];
            twin.text = joinOverlap(first.text, second.text);
            twin.order = Math.min(twin.order, s.p.order);
            twin.score = Math.max(twin.score, s.score);
        } else {
            merged.push({ docId: s.p.docId, order: s.p.order, source: s.p.source, heading: s.p.heading, text: s.p.text, score: s.score });
        }
    }

    // context budget: whole passages, highest score first
    const out = [];
    let used = 0;
    for (const m of merged.sort((a, b) => b.score - a.score)) {
        if (used + m.text.length > cfg.contextChars) continue;
        used += m.text.length;
        out.push({ source: m.source, heading: m.heading, text: m.text, score: Math.round(m.score * 1000) / 1000 });
    }
    return { passages: out, mode: semantic ? 'semantic' : 'keyword' };
}

// b usually starts with the end of a (chunk overlap): drop the repeated part
function joinOverlap(a, b) {
    for (let n = Math.min(300, a.length, b.length); n >= 20; n--) if (a.endsWith(b.slice(0, n))) return a + b.slice(n);
    return `${a}\n${b}`;
}

module.exports = { retrieve, bust, load, words, cosine, joinOverlap };
