const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');
const User = require('../models/user');
const { isObjectId } = require('../utils/validation');
const { ai } = require('../config/env');
const { getSettings } = require('../services/settings');
const { ensureAnonId, optionalUserId } = require('../services/events');
const { handleMessage } = require('../services/ai/chat');

const FIVE_MIN = 5 * 60 * 1000;
const limited = (message) => (req, res) => res.status(429).json({ message });
// customers: 20 / 5 min per account; guests: 10 / 5 min per guest cookie; everyone: 40 / 5 min per IP
const perIp = rateLimit({ windowMs: FIVE_MIN, max: 40, standardHeaders: true, legacyHeaders: false, handler: limited("You're sending messages very quickly. Please wait a moment.") });
const perUser = rateLimit({
    windowMs: FIVE_MIN,
    max: (req) => (req.chatUserId ? 20 : 10),
    keyGenerator: (req) => (req.chatUserId ? `u:${req.chatUserId}` : `g:${req.chatAnonId || req.ip}`),
    standardHeaders: true,
    legacyHeaders: false,
    handler: limited("You're sending messages very quickly. Please wait a moment."),
});

// who is chatting: the customer cookie, else the signed guest cookie (created on first use)
function identify(req, res, next) {
    req.chatUserId = optionalUserId(req);
    req.chatAnonId = req.chatUserId ? null : ensureAnonId(req, res);
    next();
}
const who = (req) => ({ userId: req.chatUserId, anonId: req.chatAnonId });

async function chatOpen() {
    if (!ai().chatEnabled) return false;
    return (await getSettings()).chatbot?.enabled !== false;
}

// Streams the reply as Server-Sent Events over a POST response (fetch streaming; cookies and a body work, unlike EventSource)
router.post('/message', express.json({ limit: '4kb' }), identify, perIp, perUser, async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const sessionId = req.body?.sessionId;
    if (!text || text.length > 1000) return res.status(400).json({ message: 'Message must be 1–1000 characters' });
    if (sessionId !== undefined && sessionId !== null && !isObjectId(sessionId)) return res.status(400).json({ message: 'Invalid chat id' });
    if (!(await chatOpen())) return res.status(503).json({ message: 'The assistant is taking a break. Please use the Contact page.' });

    res.status(200);
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (event, data) => !res.writableEnded && res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const heartbeat = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15000);
    // the customer closed the chat or the page: stop paying for an answer nobody reads
    const ctrl = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });

    try {
        const user = req.chatUserId ? await User.findById(req.chatUserId).select('name').lean() : null;
        await handleMessage({
            sessionId: sessionId || null,
            text,
            ctx: { ...who(req), userName: user?.name?.split(/\s+/)[0] || null, reqId: req.id },
            emit: send,
            signal: ctrl.signal,
        });
    } catch (err) {
        if (!ctrl.signal.aborted) {
            console.error('Chat message failed:', err);
            send('error', { message: 'Something went wrong. Please try again.', retryable: true });
        }
    } finally {
        clearInterval(heartbeat);
        res.end();
    }
});

// The customer's own conversation (last 50 messages, no tool internals)
router.get('/session/:id', identify, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(404).json({ message: 'Chat not found' });
        const session = await ChatSession.findById(req.params.id);
        if (!session || !session.ownedBy(who(req))) return res.status(404).json({ message: 'Chat not found' });
        const messages = await ChatMessage.find({ sessionId: session._id, role: { $in: ['user', 'assistant'] } }).sort({ at: -1 }).limit(50).select('role content cards feedback at').lean();
        res.json({ sessionId: String(session._id), messages: messages.reverse().map((m) => ({ id: String(m._id), role: m.role, content: m.content, cards: m.cards || [], feedback: m.feedback, at: m.at })) });
    } catch (err) {
        console.error('Chat history failed:', err);
        res.status(500).json({ message: 'Could not load the chat' });
    }
});

router.post('/feedback', express.json({ limit: '4kb' }), identify, perIp, async (req, res) => {
    try {
        const { messageId, value, note } = req.body || {};
        if (!isObjectId(messageId) || !['up', 'down'].includes(value)) return res.status(400).json({ message: "messageId and value ('up' or 'down') are required" });
        const msg = await ChatMessage.findOne({ _id: messageId, role: 'assistant' });
        const session = msg && (await ChatSession.findById(msg.sessionId));
        if (!session || !session.ownedBy(who(req))) return res.status(404).json({ message: 'Message not found' });
        msg.feedback = value;
        msg.feedbackNote = typeof note === 'string' && note.trim() ? note.trim() : null;
        await msg.save();
        res.json({ message: 'Thanks for the feedback' });
    } catch (err) {
        console.error('Chat feedback failed:', err);
        res.status(500).json({ message: 'Could not save feedback' });
    }
});

router.delete('/session/:id', identify, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(404).json({ message: 'Chat not found' });
        const session = await ChatSession.findById(req.params.id);
        if (!session || !session.ownedBy(who(req))) return res.status(404).json({ message: 'Chat not found' });
        await ChatMessage.deleteMany({ sessionId: session._id });
        await ChatSession.deleteOne({ _id: session._id });
        res.json({ message: 'Chat deleted' });
    } catch (err) {
        console.error('Chat delete failed:', err);
        res.status(500).json({ message: 'Could not delete the chat' });
    }
});

module.exports = router;
