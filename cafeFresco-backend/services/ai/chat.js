// The assistant's turn loop (UC-05): message → tools (grounded data) → answer, streamed to the browser.
// Falls back to rule-based answers whenever the AI is unavailable (A7). Every turn is stored (3.1).
const fs = require('fs');
const path = require('path');
const ChatSession = require('../../models/chatSession');
const ChatMessage = require('../../models/chatMessage');
const { chat, flagged, status, AiError } = require('./client');
const tools = require('./tools');
const fallback = require('./fallback');
const { aiProblem } = require('../alerts');
const { TZ, now } = require('../stats');

const SYSTEM = fs.readFileSync(path.join(__dirname, 'prompts', 'system.v1.txt'), 'utf8');
const MAX_ROUNDS = 4;
const MAX_PARALLEL = 3;
const HISTORY = 12;
const UNANSWERED = /\b(don't know|do not know|not sure|couldn't find|could not find|no information|haven't published|not published)\b/i;

// ---- language (A11) ----
const ROMAN_UR = /\b(kya|hai|hain|mujhe|mera|meri|aap|ap|kitna|kitne|chahiye|kab|kahan|khana|acha|nahi|kaise|batao|bata)\b/i;
function detectLanguage(text) {
    if (/[؀-ۿ]/.test(text)) return 'ur';
    if ((String(text).match(new RegExp(ROMAN_UR, 'gi')) || []).length >= 2) return 'roman-ur';
    return 'en';
}
const LANG_LINE = {
    en: 'Reply in English.',
    ur: 'Reply in Urdu script. Keep dish names exactly as the tools give them.',
    'roman-ur': 'Reply in Roman Urdu (Urdu written in English letters). Keep dish names exactly as the tools give them.',
};
// the mock reads these labels to prove the language was passed through
const LANG_LABEL = { ur: 'Reply in Urdu script', 'roman-ur': 'Reply in Roman Urdu' };

function systemPrompt({ userName, language }) {
    return SYSTEM.replace('{{CURRENCY}}', '$')
        .replace('{{NOW}}', now().format('dddd D MMMM YYYY, h:mm a'))
        .replace('{{TZ}}', TZ)
        .replace('{{CUSTOMER}}', userName ? `${userName} (logged in)` : 'a guest (not logged in)')
        .replace('{{LANGUAGE}}', LANG_LINE[language] || LANG_LINE.en);
}

// ---- one turn at a time per conversation (two tabs can't interleave a session) ----
const locks = new Map();
function serialize(key, fn) {
    const prev = locks.get(key) || Promise.resolve();
    const run = prev.catch(() => {}).then(fn);
    locks.set(key, run);
    run.finally(() => locks.get(key) === run && locks.delete(key)).catch(() => {});
    return run;
}

// ---- conversation memory: last messages verbatim + a running summary of older ones ----
async function history(session) {
    const msgs = await ChatMessage.find({ sessionId: session._id, role: { $in: ['user', 'assistant'] } }).sort({ at: 1 }).select('role content').lean();
    // only plain user/assistant text is replayed: tool calls and their results are never split across turns
    const recent = msgs.slice(-HISTORY - 1, -1); // the current user message is added separately
    const older = msgs.slice(0, Math.max(0, msgs.length - HISTORY - 1));
    return { recent: recent.map((m) => ({ role: m.role, content: m.content })), older };
}

async function refreshSummary(session, older) {
    if (!older.length || older.length <= session.summarizedUpTo || status() === 'disabled') return session.summary;
    try {
        const transcript = older.map((m) => `${m.role}: ${m.content.slice(0, 400)}`).join('\n').slice(-6000);
        const res = await chat({
            messages: [
                { role: 'system', content: 'Summarise this conversation between a restaurant assistant and a customer in at most 80 words. Keep only what the customer wants and decisions made. Do not add facts, prices or promises that are not in the text.' },
                { role: 'user', content: transcript },
            ],
            maxTokens: 150,
        });
        await ChatSession.updateOne({ _id: session._id }, { $set: { summary: res.content.slice(0, 800), summarizedUpTo: older.length } });
        return res.content;
    } catch {
        return session.summary; // keep the last good summary
    }
}

const toolCallMessage = (content, calls) => ({
    role: 'assistant',
    content: content || null,
    tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments || '{}' } })),
});

/**
 * Run one customer message.
 * ctx = { userId|null, anonId|null, userName|null, reqId }
 * emit(event, data): 'session' {sessionId}, 'token' {text}, 'cards' {cards}, 'done' {...}, 'error' {message, retryable}
 * signal: aborts the upstream AI call when the customer leaves
 */
async function handleMessage({ sessionId, text, ctx, emit, signal }) {
    const started = Date.now();
    let session = sessionId ? await ChatSession.findById(sessionId) : null;
    if (session && !session.ownedBy(ctx)) session = null; // someone else's chat: start a new one, never reveal it exists
    if (!session) session = await ChatSession.create({ userId: ctx.userId || null, anonId: ctx.userId ? null : ctx.anonId });
    emit('session', { sessionId: String(session._id) });

    return serialize(String(session._id), async () => {
        const language = detectLanguage(text);
        await ChatMessage.create({ sessionId: session._id, role: 'user', content: text });
        const toolCtx = { ...ctx, sessionId: session._id };

        let content = '';
        let cards = [];
        let source = status() === 'mock' ? 'mock' : 'ai';
        let tokensIn = 0;
        let tokensOut = 0;
        const streamText = (t) => {
            content += t;
            emit('token', { text: t });
        };

        if (await flagged(text)) {
            source = 'moderation';
            streamText("I can't help with that. I'm here for Cafe Fresco orders, menu and shop questions.");
        } else {
            try {
                const { recent, older } = await history(session);
                const summary = await refreshSummary(session, older);
                const sys = systemPrompt({ userName: ctx.userName, language }) + (LANG_LABEL[language] && status() === 'mock' ? `\n${LANG_LABEL[language]}` : '');
                const messages = [
                    { role: 'system', content: sys },
                    ...(summary ? [{ role: 'system', content: `Summary of the earlier conversation (may be incomplete): ${summary}` }] : []),
                    ...recent,
                    { role: 'user', content: text },
                ];
                const schemas = tools.schemas();
                for (let round = 0; ; round++) {
                    const last = round >= MAX_ROUNDS; // out of rounds: answer with what we have, no more tools
                    // tokens go to the browser as they arrive (any short "let me check" before a tool call stays)
                    let streamed = '';
                    const res = await chat({ messages, tools: last ? undefined : schemas, maxTokens: 500, signal, onDelta: (d) => { streamed += d; streamText(d); } });
                    tokensIn += res.usage.in;
                    tokensOut += res.usage.out;
                    if (!res.toolCalls.length || last) {
                        if (!streamed) streamText(res.content || "Sorry, I couldn't find an answer to that.");
                        break;
                    }
                    if (streamed) streamText('\n\n');
                    const calls = res.toolCalls.slice(0, MAX_PARALLEL);
                    messages.push(toolCallMessage(res.content, res.toolCalls));
                    const runs = await Promise.all(calls.map((c) => tools.run(c.name, c.arguments, toolCtx)));
                    // every tool_call id gets a result message, even the ones over the parallel limit
                    res.toolCalls.forEach((c, i) => {
                        const r = runs[i];
                        messages.push({ role: 'tool', tool_call_id: c.id, name: c.name, content: r ? r.content : JSON.stringify({ error: 'too_many_calls', message: 'Ask for fewer things at once.' }) });
                    });
                    const newCards = runs.flatMap((r) => r.cards || []);
                    if (newCards.length) {
                        cards = [...cards, ...newCards].filter((c, i, all) => all.findIndex((x) => x.type === c.type && x.id === c.id && x.productId === c.productId) === i).slice(0, 8);
                        emit('cards', { cards: newCards });
                    }
                    await ChatMessage.insertMany(runs.map((r) => ({ sessionId: session._id, role: 'tool', toolName: r.name, toolArgs: r.args || null, toolResultSummary: r.content.slice(0, 300) })));
                }
            } catch (err) {
                if (signal?.aborted) throw err;
                if (!(err instanceof AiError)) console.error('Chat turn failed, using rule-based answer:', err);
                else aiProblem(err.code); // outage / budget → one dashboard alert (deduplicated)
                // A7: never a blank reply — rule-based answer from the same tools
                source = 'fallback';
                if (content) emit('reset', {}); // the browser drops the half-streamed AI text
                content = '';
                cards = [];
                const fb = await fallback.respond(text, toolCtx);
                cards = fb.cards;
                if (fb.cards.length) emit('cards', { cards: fb.cards });
                for (const piece of fb.content.match(/.{1,24}/gs) || []) streamText(piece);
            }
        }

        const reply = await ChatMessage.create({
            sessionId: session._id,
            role: 'assistant',
            content,
            cards,
            tokensIn,
            tokensOut,
            latencyMs: Date.now() - started,
            source,
            unanswered: UNANSWERED.test(content),
        });
        await ChatSession.updateOne({ _id: session._id }, { $set: { lastAt: new Date(), language }, $inc: { messageCount: 2 } });
        emit('done', { messageId: String(reply._id), sessionId: String(session._id), source });
        return { sessionId: String(session._id), messageId: String(reply._id), content, cards, source };
    });
}

module.exports = { handleMessage, detectLanguage, systemPrompt };
