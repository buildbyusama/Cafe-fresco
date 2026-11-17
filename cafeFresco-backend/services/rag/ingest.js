// Upload → passages the assistant can search (docs/RAG_PLAN.md R1.3): extract → chunk → embed → ready.
// Safe against races (delete / replace while processing), budget-aware (R9) and Vercel-safe (sync by default, R8).
const crypto = require('crypto');
const Document = require('../../models/document');
const DocChunk = require('../../models/docChunk');
const { rag, ai } = require('../../config/env');
const { embed, status, usedToday, dailyBudget, AiError } = require('../ai/client');
const { extract, ExtractError } = require('./extract');
const { chunk } = require('./chunk');
const { changed } = require('./documents');

const hashOf = (t) => crypto.createHash('sha1').update(t).digest('hex');

// at most 2 ingests at once (each one is CPU and memory heavy)
let running = 0;
const waiting = [];
const slot = () => (running < 2 ? (running++, Promise.resolve()) : new Promise((r) => waiting.push(r)).then(() => { running++; }));
const release = () => { running--; waiting.shift()?.(); };

class IngestError extends Error {}

// Vectors for passages that lack them (or whose text changed). AI off / over budget → leave them keyword-only.
async function embedChunks(chunks) {
    const todo = chunks.filter((c) => c.embeddingHash !== hashOf(c.text));
    if (!todo.length || status() === 'disabled') return { embedded: 0, skipped: chunks.length - todo.length, keywordOnly: status() === 'disabled' && todo.length > 0 };
    // batches of 64, three at a time: a 200-page document is 7 batches, so ~3 round trips instead of 7
    const batches = [];
    for (let i = 0; i < todo.length; i += 64) batches.push(todo.slice(i, i + 64));
    for (let i = 0; i < batches.length; i += 3) {
        await Promise.all(batches.slice(i, i + 3).map(async (batch) => {
            const vectors = await embed(batch.map((c) => (c.heading ? `${c.heading}\n${c.text}` : c.text)), { dimensions: rag().dims });
            await DocChunk.bulkWrite(batch.map((c, j) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { embedding: vectors[j], embeddingHash: hashOf(c.text) } } } })));
        }));
    }
    return { embedded: todo.length, skipped: chunks.length - todo.length, keywordOnly: false };
}

/**
 * Process one upload for doc (already saved as processing at doc.version). Resolves to the final document.
 * Never throws: failures end as status 'failed' with a friendly reason.
 */
async function ingest(docId, buffer, originalName) {
    await slot();
    let version = null;
    try {
        const doc = await Document.findById(docId);
        if (!doc || doc.status === 'deleting') return null;
        version = doc.version;

        const { text, pages, mime, privacyFlags } = await extract(buffer, originalName);
        const parts = chunk(text);
        if (!parts.length) throw new IngestError('No readable passages were found in this file.');

        // the whole library has a size limit (memory for search vectors)
        const others = await DocChunk.countDocuments({ documentId: { $ne: doc._id } });
        if (others + parts.length > rag().maxPassagesTotal) throw new IngestError('The document library is full. Delete documents you no longer need, then try again.');

        // R9: one upload may use at most half of what is left of today's AI budget
        if (status() !== 'disabled') {
            const estimate = Math.ceil(text.length / 4);
            const left = Math.max(0, (await dailyBudget()) - (await usedToday()));
            if (estimate > left * rag().budgetShare) throw new IngestError("This document is too large for today's remaining AI budget. Try again tomorrow, or raise the budget in Assistant settings.");
        }

        await DocChunk.deleteMany({ documentId: doc._id, version });
        const saved = await DocChunk.insertMany(parts.map((p) => ({ documentId: doc._id, version, ...p })));
        const { keywordOnly } = await embedChunks(saved.map((c) => ({ _id: c._id, text: c.text, heading: c.heading })));

        // a delete or a newer "Replace file" may have happened meanwhile: never resurrect or mix versions
        const now = await Document.findOneAndUpdate(
            { _id: doc._id, version, status: 'processing' },
            { $set: { status: 'ready', servingVersion: version, error: null, mime, pages, chars: text.length, chunkCount: parts.length, privacyFlags, ...(keywordOnly ? { error: 'Searchable by keywords only until an OpenAI key is set (then Re-index).' } : {}) } },
            { new: true }
        );
        if (!now) {
            await DocChunk.deleteMany({ documentId: doc._id, version });
            return Document.findById(doc._id);
        }
        await DocChunk.deleteMany({ documentId: doc._id, version: { $ne: version } }); // older versions retire
        changed();
        return now;
    } catch (err) {
        const reason = err instanceof ExtractError || err instanceof IngestError ? err.message
            : err instanceof AiError && err.code === 'budget' ? "Today's AI budget is used up. Re-index this document tomorrow."
            : err instanceof AiError ? 'The AI service is unavailable right now. Re-index this document in a few minutes.'
            : 'Processing failed. Please try again.';
        if (!(err instanceof ExtractError || err instanceof IngestError || err instanceof AiError)) console.error('Document ingest failed:', err);
        if (version !== null) {
            await DocChunk.deleteMany({ documentId: docId, version });
            // a replace that fails keeps the previous version serving; a first upload just fails
            const doc = await Document.findById(docId);
            if (doc && doc.version === version && doc.status !== 'deleting') {
                // the previous version (servingVersion) keeps answering questions until a new file works
                await Document.updateOne(
                    { _id: docId, version },
                    doc.servingVersion > 0 ? { $set: { status: 'ready', version: doc.servingVersion, error: `The new file couldn't be used: ${reason}` } } : { $set: { status: 'failed', error: reason } }
                );
                changed();
            }
        }
        return Document.findById(docId);
    } finally {
        release();
    }
}

// Re-embed from the stored passage text (the original file isn't kept). Only changed passages cost tokens.
async function reindex(docId) {
    const doc = await Document.findById(docId);
    if (!doc || doc.status !== 'ready' || !doc.servingVersion) return { embedded: 0, skipped: 0 };
    const chunks = await DocChunk.find({ documentId: doc._id, version: doc.servingVersion }).select('+embeddingHash text heading').lean();
    const r = await embedChunks(chunks);
    if (!r.keywordOnly) await Document.updateOne({ _id: doc._id }, { $set: { error: null } });
    changed();
    return r;
}

module.exports = { ingest, reindex, embedChunks, IngestError, model: () => ai().embedModel };
