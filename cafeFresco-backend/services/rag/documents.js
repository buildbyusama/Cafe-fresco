// Document lifecycle helpers shared by the ingest pipeline and the admin API
const Document = require('../../models/document');
const DocChunk = require('../../models/docChunk');

let onChange = () => {}; // retrieval registers its cache reset here (avoids a require cycle)
const setOnChange = (fn) => { onChange = fn; };
const changed = () => { try { onChange(); } catch { /* cache reset never breaks a request */ } };

// Delete a document and all its passages. Safe to call twice. The 'deleting' status stops any ingest
// still running for it from finishing (it re-checks before marking ready).
async function deleteDocument(id) {
    await Document.updateOne({ _id: id }, { $set: { status: 'deleting', isPublished: false } });
    changed();
    await DocChunk.deleteMany({ documentId: id });
    await Document.deleteOne({ _id: id });
    changed();
}

const STALE_MS = 10 * 60 * 1000;

// Documents stuck in 'processing' (the server stopped mid-ingest) are marked failed when read.
// Age-based, because a "server start" hook isn't reliable on serverless hosting.
async function failStale() {
    const r = await Document.updateMany(
        { status: 'processing', processingStartedAt: { $lt: new Date(Date.now() - STALE_MS) } },
        { $set: { status: 'failed', error: 'Processing was interrupted. Re-index it or upload it again.' } }
    );
    if (r.modifiedCount) changed();
    return r.modifiedCount;
}

module.exports = { deleteDocument, failStale, setOnChange, changed, STALE_MS };
