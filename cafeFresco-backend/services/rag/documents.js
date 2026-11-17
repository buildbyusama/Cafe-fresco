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
// An interrupted "Replace file" goes back to the version that was serving (it never stops answering);
// an interrupted first upload fails. Passages of the abandoned version are removed.
async function failStale() {
    const stale = { status: 'processing', processingStartedAt: { $lt: new Date(Date.now() - STALE_MS) } };
    const stuck = await Document.find(stale).select('_id version servingVersion').lean();
    if (!stuck.length) return 0;
    const restore = (withSha) => Document.updateMany({ ...stale, servingVersion: { $gt: 0 } }, [{ $set: { status: 'ready', version: '$servingVersion', ...(withSha ? { sha256: { $ifNull: ['$previousSha256', '$sha256'] } } : {}), previousSha256: null, error: "The new file's processing was interrupted, so the previous version is still in use. Upload it again." } }]);
    const [back, failed] = await Promise.all([
        restore(true).catch((e) => (e?.code === 11000 ? restore(false) : Promise.reject(e))), // the old file was uploaded again meanwhile
        Document.updateMany({ ...stale, servingVersion: 0 }, { $set: { status: 'failed', error: 'Processing was interrupted. Upload the file again.' } }),
    ]);
    const abandoned = stuck.filter((d) => d.version !== d.servingVersion).map((d) => ({ documentId: d._id, version: d.version }));
    if (abandoned.length) await DocChunk.deleteMany({ $or: abandoned });
    changed();
    return back.modifiedCount + failed.modifiedCount;
}

module.exports = { deleteDocument, failStale, setOnChange, changed, STALE_MS };
