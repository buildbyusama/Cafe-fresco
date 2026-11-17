// Document library admin API (docs/RAG_PLAN.md R2.1). Admin + manager. Changes appear in the activity log.
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Document = require('../models/document');
const DocChunk = require('../models/docChunk');
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const { isObjectId } = require('../utils/validation');
const { rag } = require('../config/env');
const { ingest, reindex } = require('../services/rag/ingest');
const { deleteDocument, failStale, changed } = require('../services/rag/documents');

const managers = [isAdmin, authorizeRoles('admin', 'manager')];
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => `doc:${req.admin?.userId || req.ip}`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: 'Too many uploads this hour. Please try again later.' }),
});

// one file in memory; size limit from the config (4 MB on Vercel)
function receiveFile(req, res, next) {
    multer({ storage: multer.memoryStorage(), limits: { fileSize: rag().maxFileMb * 1024 * 1024, files: 1, fields: 5 } }).single('file')(req, res, (err) => {
        if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: `Files must be under ${rag().maxFileMb} MB. Split bigger documents into parts.` });
        if (err) return res.status(400).json({ message: 'Upload one file in the "file" field.' });
        if (!req.file) return res.status(400).json({ message: 'Choose a file to upload.' });
        next();
    });
}

const titleFrom = (body, file) => String(body.title || '').trim() || path.parse(file.originalname || 'Document').name.replace(/[_-]+/g, ' ');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// What the admin sees (never vectors or internal ids of passages)
const view = (d) => ({
    _id: d._id, title: d.title, fileName: d.fileName, mime: d.mime, sizeBytes: d.sizeBytes, status: d.status, error: d.error,
    isPublished: d.isPublished, pages: d.pages, chars: d.chars, chunkCount: d.chunkCount, privacyFlags: d.privacyFlags,
    version: d.version, servingVersion: d.servingVersion, createdAt: d.createdAt, updatedAt: d.updatedAt,
});

// sync (default, Vercel-safe): processed inside the request; background: answered at once (long-running servers)
async function run(doc, file, res, created) {
    if (rag().ingestMode === 'background') {
        setImmediate(() => ingest(doc._id, file.buffer, file.originalname));
        return res.status(202).json({ message: 'Processing started', document: view(doc) });
    }
    const done = await ingest(doc._id, file.buffer, file.originalname);
    return res.status(created ? 201 : 200).json({ message: done?.status === 'ready' ? 'Document ready' : done?.error || 'Processing failed', document: done ? view(done) : null });
}

const duplicateOf = async (hash, exceptId) => Document.findOne({ sha256: hash, ...(exceptId ? { _id: { $ne: exceptId } } : {}), status: { $ne: 'deleting' } }).select('title').lean();

router.post('/', ...managers, uploadLimiter, receiveFile, async (req, res) => {
    try {
        const hash = sha(req.file.buffer);
        const dup = await duplicateOf(hash);
        if (dup) return res.status(409).json({ message: `This file is already uploaded as "${dup.title}".` });
        if ((await Document.countDocuments({ status: { $ne: 'deleting' } })) >= rag().maxDocs) return res.status(409).json({ message: `The library holds up to ${rag().maxDocs} documents. Delete one first.` });
        const title = titleFrom(req.body, req.file);
        if (title.length < 2) return res.status(400).json({ message: 'Give the document a title (2–80 characters).' });
        let doc;
        try {
            doc = await Document.create({ title, fileName: req.file.originalname, mime: 'text/plain', sizeBytes: req.file.size, sha256: hash, uploadedBy: req.admin.userId, updatedBy: req.admin.userId });
        } catch (e) {
            if (e?.code === 11000) return res.status(409).json({ message: 'This file is already uploaded.' }); // two uploads at once
            throw e;
        }
        await run(doc, req.file, res, true);
    } catch (err) {
        console.error('Document upload failed:', err);
        res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
});

// New file for an existing document: keeps title and published state; the old version answers until the new one is ready
router.post('/:id/replace', ...managers, uploadLimiter, receiveFile, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const hash = sha(req.file.buffer);
        const dup = await duplicateOf(hash, req.params.id);
        if (dup) return res.status(409).json({ message: `This file is already uploaded as "${dup.title}".` });
        const doc = await Document.findOneAndUpdate(
            { _id: req.params.id, status: { $in: ['ready', 'failed'] } },
            { $inc: { version: 1 }, $set: { status: 'processing', processingStartedAt: new Date(), sha256: hash, fileName: req.file.originalname, sizeBytes: req.file.size, error: null, updatedBy: req.admin.userId } },
            { new: true }
        );
        if (!doc) return res.status(409).json({ message: 'This document is still processing or no longer exists.' });
        await run(doc, req.file, res, false);
    } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ message: 'This file is already uploaded.' });
        console.error('Document replace failed:', err);
        res.status(500).json({ message: 'Replace failed. Please try again.' });
    }
});

router.get('/', ...managers, async (req, res) => {
    try {
        await failStale();
        const filter = { status: { $ne: 'deleting' } };
        if (['processing', 'ready', 'failed'].includes(req.query.status)) filter.status = req.query.status;
        if (req.query.published === 'true') filter.isPublished = true;
        if (req.query.published === 'false') filter.isPublished = false;
        if (req.query.q) filter.title = { $regex: String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80), $options: 'i' };
        const [docs, total, passages] = await Promise.all([Document.find(filter).sort({ updatedAt: -1 }).lean(), Document.countDocuments({ status: { $ne: 'deleting' } }), DocChunk.countDocuments()]);
        res.json({ documents: docs.map(view), limits: { maxFileMb: rag().maxFileMb, maxDocs: rag().maxDocs, documents: total, passages, maxPassages: rag().maxPassagesTotal } });
    } catch (err) {
        console.error('Document list failed:', err);
        res.status(500).json({ message: 'Could not load documents' });
    }
});

router.get('/:id', ...managers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        await failStale();
        const doc = await Document.findOne({ _id: req.params.id, status: { $ne: 'deleting' } }).lean();
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const preview = await DocChunk.find({ documentId: doc._id, version: doc.servingVersion }).sort({ order: 1 }).limit(3).select('heading text').lean();
        res.json({ document: view(doc), preview: preview.map((p) => ({ heading: p.heading, text: p.text })) });
    } catch (err) {
        console.error('Document read failed:', err);
        res.status(500).json({ message: 'Could not load the document' });
    }
});

router.put('/:id', ...managers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const doc = await Document.findOne({ _id: req.params.id, status: { $ne: 'deleting' } });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        const { title, isPublished, confirmPrivacy } = req.body || {};
        if (title !== undefined) {
            const clean = Document.cleanTitle(title);
            if (clean.length < 2) return res.status(400).json({ message: 'Title must be 2–80 characters' });
            doc.title = clean;
        }
        if (isPublished !== undefined) {
            const on = isPublished === true || isPublished === 'true';
            if (on && !doc.servingVersion) return res.status(409).json({ message: 'This document has no processed version yet.' });
            if (on && doc.privacyFlags?.length && confirmPrivacy !== true) {
                return res.status(409).json({ message: 'This document may contain personal data. Confirm before publishing.', privacyFlags: doc.privacyFlags, needsConfirmation: true });
            }
            doc.isPublished = on;
        }
        doc.updatedBy = req.admin.userId;
        await doc.save();
        changed();
        res.json({ message: 'Saved', document: view(doc) });
    } catch (err) {
        console.error('Document update failed:', err);
        res.status(500).json({ message: 'Could not save the document' });
    }
});

router.delete('/:id', ...managers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        if (!(await Document.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'Document not found' });
        await deleteDocument(req.params.id);
        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Document delete failed:', err);
        res.status(500).json({ message: 'Could not delete the document' });
    }
});

router.post('/:id/reindex', ...managers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const doc = await Document.findById(req.params.id);
        if (!doc || doc.status === 'deleting') return res.status(404).json({ message: 'Document not found' });
        if (!doc.servingVersion) return res.status(409).json({ message: 'Upload the file again: this document has no processed text.' });
        const r = await reindex(doc._id);
        res.json({ message: r.keywordOnly ? 'Saved for keyword search; add an OpenAI key for smart search.' : `Re-indexed: ${r.embedded} passage(s) updated, ${r.skipped} unchanged.`, ...r });
    } catch (err) {
        console.error('Document reindex failed:', err);
        res.status(err.code === 'budget' ? 409 : 500).json({ message: err.code === 'budget' ? "Today's AI budget is used up. Try again tomorrow." : 'Re-index failed. Please try again.' });
    }
});

module.exports = router;
module.exports.view = view;
