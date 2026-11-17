// Dashboard view of the assistant (SRS 4.7 / 5.8): usage, quality, cost, transcripts. Admin + manager.
const express = require('express');
const router = express.Router();
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');
const AiUsage = require('../models/aiUsage');
const User = require('../models/user');
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const { isObjectId } = require('../utils/validation');
const { TZ, now } = require('../services/stats');
const { ai } = require('../config/env');
const { status } = require('../services/ai/client');

const viewers = [isAdmin, authorizeRoles('admin', 'manager')];

// [start, end) for the last N days in the shop's timezone, plus the day labels
function window(range) {
    const days = range === '30d' ? 30 : 7;
    const end = now().endOf('day');
    const start = end.clone().subtract(days - 1, 'days').startOf('day');
    const labels = Array.from({ length: days }, (_, i) => start.clone().add(i, 'days').format('YYYY-MM-DD'));
    return { start: start.toDate(), end: end.toDate(), labels, days };
}

const normalise = (q) => String(q || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

router.get('/stats', ...viewers, async (req, res) => {
    try {
        const { start, end, labels } = window(req.query.range);
        const at = { $gte: start, $lte: end };
        const [sessions, escalations, assistant, users, perDay, toolsUsed, usage, unanswered, docLookups, topSources, docMisses] = await Promise.all([
            ChatSession.countDocuments({ startedAt: at }),
            ChatSession.countDocuments({ escalated: true, lastAt: at }),
            ChatMessage.aggregate([
                { $match: { role: 'assistant', at } },
                { $group: { _id: null, total: { $sum: 1 }, fallback: { $sum: { $cond: [{ $eq: ['$source', 'fallback'] }, 1, 0] } }, up: { $sum: { $cond: [{ $eq: ['$feedback', 'up'] }, 1, 0] } }, down: { $sum: { $cond: [{ $eq: ['$feedback', 'down'] }, 1, 0] } }, unanswered: { $sum: { $cond: ['$unanswered', 1, 0] } }, latency: { $avg: '$latencyMs' } } },
            ]),
            ChatMessage.find({ role: 'user', at }).select('content').lean(),
            ChatMessage.aggregate([
                { $match: { role: 'user', at } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: TZ } }, n: { $sum: 1 } } },
            ]),
            ChatMessage.aggregate([{ $match: { role: 'tool', at } }, { $group: { _id: '$toolName', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
            AiUsage.find({ day: { $gte: labels[0], $lte: labels.at(-1) } }).lean(),
            ChatMessage.find({ role: 'assistant', unanswered: true, at }).sort({ at: -1 }).limit(20).select('sessionId at').lean(),
            // documents (RAG): how often they are searched, which ones answer, and what they don't cover
            ChatMessage.countDocuments({ role: 'tool', toolName: 'search_documents', at }),
            ChatMessage.aggregate([
                { $match: { role: 'assistant', at, 'cards.type': 'source' } },
                { $unwind: '$cards' },
                { $match: { 'cards.type': 'source' } },
                { $group: { _id: { m: '$_id', title: '$cards.title' } } }, // a document counts once per answer
                { $group: { _id: '$_id.title', n: { $sum: 1 } } },
                { $sort: { n: -1, _id: 1 } },
                { $limit: 10 },
            ]),
            ChatMessage.find({ role: 'tool', toolName: 'search_documents', at, toolResultSummary: { $regex: '^\\{"passages":\\[\\]' } }).sort({ at: -1 }).limit(200).select('toolArgs').lean(),
        ]);
        const a = assistant[0] || { total: 0, fallback: 0, up: 0, down: 0, unanswered: 0, latency: 0 };

        // questions asked at least 3 times (normalised text)
        const counts = new Map();
        for (const m of users) {
            const k = normalise(m.content);
            if (k.length >= 3) counts.set(k, (counts.get(k) || 0) + 1);
        }
        const topQuestions = [...counts.entries()].filter(([, n]) => n >= 3).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([question, count]) => ({ question, count }));

        // the customer question behind each "I don't know" answer
        const unansweredList = await Promise.all(
            unanswered.map(async (u) => {
                const q = await ChatMessage.findOne({ sessionId: u.sessionId, role: 'user', at: { $lte: u.at } }).sort({ at: -1 }).select('content').lean();
                return { sessionId: String(u.sessionId), question: q?.content?.slice(0, 200) || '', at: u.at };
            })
        );

        // questions the documents couldn't answer, most asked first
        const missCounts = new Map();
        for (const m of docMisses) {
            const question = String(m.toolArgs?.query || '').trim().slice(0, 200);
            const k = normalise(question);
            if (k.length < 3) continue;
            const prev = missCounts.get(k);
            missCounts.set(k, { question: prev?.question || question, count: (prev?.count || 0) + 1 });
        }
        const documentGaps = [...missCounts.values()].sort((x, y) => y.count - x.count).slice(0, 10);

        const tokensIn = usage.reduce((n, d) => n + (d.tokensIn || 0), 0);
        const tokensOut = usage.reduce((n, d) => n + (d.tokensOut || 0), 0);
        const { priceIn, priceOut } = ai();
        const byDay = new Map(perDay.map((d) => [d._id, d.n]));
        res.json({
            range: req.query.range === '30d' ? '30d' : '7d',
            aiStatus: status(),
            sessions,
            messages: users.length,
            avgMessagesPerSession: sessions ? Math.round((users.length / sessions) * 10) / 10 : 0,
            answers: a.total,
            fallbackRate: a.total ? Math.round((a.fallback / a.total) * 1000) / 10 : 0,
            thumbsUp: a.up,
            thumbsDown: a.down,
            unanswered: a.unanswered,
            escalations,
            avgLatencyMs: Math.round(a.latency || 0),
            tokens: { in: tokensIn, out: tokensOut },
            estimatedCost: Math.round(((tokensIn * priceIn + tokensOut * priceOut) / 1e6) * 100) / 100,
            perDay: labels.map((d) => ({ day: d, messages: byDay.get(d) || 0 })),
            tools: toolsUsed.map((t) => ({ tool: t._id, count: t.n })),
            topQuestions,
            unansweredList,
            documents: { lookups: docLookups, topSources: topSources.map((x) => ({ title: x._id, count: x.n })), gaps: documentGaps },
        });
    } catch (err) {
        console.error('Chat stats failed:', err);
        res.status(500).json({ message: 'Could not load assistant stats' });
    }
});

// Conversations, newest first. filter: escalated | thumbs-down | fallback | unanswered
router.get('/sessions', ...viewers, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
        const filter = {};
        const f = req.query.filter;
        if (f === 'escalated') filter.escalated = true;
        else if (['thumbs-down', 'fallback', 'unanswered'].includes(f)) {
            const match = f === 'thumbs-down' ? { feedback: 'down' } : f === 'fallback' ? { source: 'fallback' } : { unanswered: true };
            filter._id = { $in: await ChatMessage.distinct('sessionId', { role: 'assistant', ...match }) };
        }
        const [total, sessions] = await Promise.all([ChatSession.countDocuments(filter), ChatSession.find(filter).sort({ lastAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
        const names = new Map((await User.find({ _id: { $in: sessions.map((s) => s.userId).filter(Boolean) } }).select('name').lean()).map((u) => [String(u._id), u.name]));
        const firsts = await ChatMessage.aggregate([
            { $match: { sessionId: { $in: sessions.map((s) => s._id) }, role: 'user' } },
            { $sort: { at: 1 } },
            { $group: { _id: '$sessionId', first: { $first: '$content' } } },
        ]);
        const firstBy = new Map(firsts.map((x) => [String(x._id), x.first]));
        res.json({
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            sessions: sessions.map((s) => ({
                id: String(s._id),
                // A9: first name only, never email or phone
                customer: s.userId ? (names.get(String(s.userId)) || 'Customer').split(/\s+/)[0] : 'Guest',
                startedAt: s.startedAt,
                lastAt: s.lastAt,
                messages: s.messageCount,
                escalated: s.escalated,
                language: s.language,
                firstMessage: (firstBy.get(String(s._id)) || '').slice(0, 140),
            })),
        });
    } catch (err) {
        console.error('Chat sessions failed:', err);
        res.status(500).json({ message: 'Could not load conversations' });
    }
});

router.get('/sessions/:id', ...viewers, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const s = await ChatSession.findById(req.params.id).lean();
        if (!s) return res.status(404).json({ message: 'Conversation not found' });
        const user = s.userId ? await User.findById(s.userId).select('name').lean() : null;
        const msgs = await ChatMessage.find({ sessionId: s._id }).sort({ at: 1 }).limit(200).lean();
        res.json({
            id: String(s._id),
            customer: user ? user.name.split(/\s+/)[0] : 'Guest',
            escalated: s.escalated,
            startedAt: s.startedAt,
            messages: msgs.map((m) => ({
                role: m.role,
                content: m.role === 'tool' ? `${m.toolName}(${m.toolArgs ? JSON.stringify(m.toolArgs).slice(0, 120) : ''})` : m.content,
                source: m.source,
                feedback: m.feedback,
                feedbackNote: m.feedbackNote,
                unanswered: m.unanswered,
                sources: (m.cards || []).filter((c) => c.type === 'source').map((c) => ({ title: c.title, section: c.section })),
                at: m.at,
            })),
        });
    } catch (err) {
        console.error('Chat transcript failed:', err);
        res.status(500).json({ message: 'Could not load the conversation' });
    }
});

// Today's AI usage against the budget (Assistant settings page)
router.get('/usage', ...viewers, async (req, res) => {
    try {
        const { usedToday, dailyBudget } = require('../services/ai/client');
        res.json({ status: status(), usedToday: await usedToday(), budget: await dailyBudget(), maxBudget: ai().dailyBudget, model: ai().model });
    } catch (err) {
        console.error('Usage read failed:', err);
        res.status(500).json({ message: 'Could not load usage' });
    }
});

// Rebuild search vectors for the menu and FAQ (only changed items cost tokens). One run at a time.
let reindexing = false;
router.post('/reindex', isAdmin, authorizeRoles('admin'), async (req, res) => {
    if (status() === 'disabled') return res.status(409).json({ message: 'Add an OpenAI API key on the server first. Search works without it, using keywords.' });
    if (reindexing) return res.status(409).json({ message: 'Re-indexing is already running. Try again in a minute.' });
    reindexing = true;
    try {
        const { embedProducts, embedKnowledge } = require('../services/ai/embeddings');
        const [dishes, faq] = [await embedProducts(), await embedKnowledge()];
        res.json({ message: 'Search index is up to date', dishes, faq });
    } catch (err) {
        console.error('Re-index failed:', err);
        res.status(err.code === 'budget' ? 409 : 502).json({ message: err.code === 'budget' ? "Today's AI budget is used up. Try again tomorrow." : 'Re-indexing failed. Please try again.' });
    } finally {
        reindexing = false;
    }
});

module.exports = router;
