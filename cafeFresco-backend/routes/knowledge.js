const express = require('express');
const router = express.Router();
const Knowledge = require('../models/knowledge');
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const { isObjectId, escapeRegex } = require('../utils/validation');
const { embedKnowledge } = require('../services/ai/embeddings');
const { searchKnowledge } = require('../services/ai/tools/store');
const { AiError } = require('../services/ai/client');

// R1: admin and manager write the assistant's FAQ
const writers = [isAdmin, authorizeRoles('admin', 'manager')];

function parse(body, { partial }) {
    const value = {};
    const fields = {};
    if (!partial || body.question !== undefined) {
        value.question = String(body.question ?? '').trim();
        if (value.question.length < 5 || value.question.length > 200) fields.question = 'Question must be 5–200 characters';
    }
    if (!partial || body.answer !== undefined) {
        value.answer = String(body.answer ?? '').trim();
        if (value.answer.length < 2 || value.answer.length > 1500) fields.answer = 'Answer must be 2–1500 characters';
    }
    if (body.tags !== undefined) {
        if (!Array.isArray(body.tags) || body.tags.length > 10) fields.tags = 'Up to 10 tags';
        else value.tags = [...new Set(body.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
    }
    if (body.isActive !== undefined) value.isActive = body.isActive === true || body.isActive === 'true';
    return Object.keys(fields).length ? { fields } : { value };
}

// re-embed after a change; never blocks or fails the save (no key → keyword search still works)
const reembed = (id) => embedKnowledge([id]).catch((err) => { if (!(err instanceof AiError)) console.error('FAQ embedding failed:', err.message); });

router.get('/', ...writers, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const filter = {};
        const q = String(req.query.q || '').trim();
        if (q) filter.$or = [{ question: { $regex: escapeRegex(q), $options: 'i' } }, { answer: { $regex: escapeRegex(q), $options: 'i' } }];
        if (req.query.status === 'active') filter.isActive = true;
        if (req.query.status === 'draft') filter.isActive = false;
        const [total, entries] = await Promise.all([Knowledge.countDocuments(filter), Knowledge.find(filter).sort({ isActive: 1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
        res.json({ total, page, totalPages: Math.max(1, Math.ceil(total / limit)), entries });
    } catch (err) {
        console.error('FAQ list failed:', err);
        res.status(500).json({ message: 'Could not load the FAQ' });
    }
});

// "Test a question": which active entries the assistant would use
router.post('/test', ...writers, async (req, res) => {
    try {
        const q = String(req.body?.question || '').trim();
        if (q.length < 3) return res.status(400).json({ message: 'Type a question to test' });
        res.json({ entries: await searchKnowledge(q) });
    } catch (err) {
        console.error('FAQ test failed:', err);
        res.status(500).json({ message: 'Could not test the question' });
    }
});

router.post('/', ...writers, async (req, res) => {
    try {
        const parsed = parse(req.body || {}, { partial: false });
        if (parsed.fields) return res.status(400).json({ message: Object.values(parsed.fields)[0], fields: parsed.fields });
        const entry = await Knowledge.create({ ...parsed.value, updatedBy: req.admin.userId });
        reembed(entry._id);
        res.status(201).json({ message: 'FAQ entry added', entry });
    } catch (err) {
        console.error('FAQ create failed:', err);
        res.status(500).json({ message: 'Could not add the entry' });
    }
});

router.put('/:id', ...writers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const parsed = parse(req.body || {}, { partial: true });
        if (parsed.fields) return res.status(400).json({ message: Object.values(parsed.fields)[0], fields: parsed.fields });
        const entry = await Knowledge.findByIdAndUpdate(req.params.id, { $set: { ...parsed.value, updatedBy: req.admin.userId } }, { new: true, runValidators: true });
        if (!entry) return res.status(404).json({ message: 'FAQ entry not found' });
        reembed(entry._id);
        res.json({ message: 'FAQ entry saved', entry });
    } catch (err) {
        console.error('FAQ update failed:', err);
        res.status(500).json({ message: 'Could not save the entry' });
    }
});

router.delete('/:id', ...writers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const gone = await Knowledge.findByIdAndDelete(req.params.id);
        if (!gone) return res.status(404).json({ message: 'FAQ entry not found' });
        res.json({ message: 'FAQ entry deleted' });
    } catch (err) {
        console.error('FAQ delete failed:', err);
        res.status(500).json({ message: 'Could not delete the entry' });
    }
});

module.exports = router;
