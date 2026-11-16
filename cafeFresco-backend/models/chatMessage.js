const mongoose = require('mongoose');

const days = () => Number(process.env.CHAT_RETENTION_DAYS || 30);
const MAX = 4000;

// Card numbers, CVCs and passwords never get stored, even if a customer types them
function scrub(text) {
    return String(text ?? '')
        .replace(/\b\d(?:[ -]?\d){12,18}\b/g, '[card number removed]')
        .replace(/\b(cvc|cvv|security code)\s*[:=]?\s*\d{3,4}\b/gi, '$1 [removed]')
        .replace(/\b(password|passcode|pin)\b(\s*(is|:|=)\s*)\S+/gi, '$1$2[removed]')
        .slice(0, MAX);
}

const chatMessageSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'chatSession', required: true },
    role: { type: String, enum: ['user', 'assistant', 'tool'], required: true },
    content: { type: String, default: '', set: scrub },
    toolName: { type: String, default: null },
    toolArgs: { type: Object, default: null },
    toolResultSummary: { type: String, default: null, set: (v) => (v == null ? v : scrub(v).slice(0, 300)) },
    cards: { type: Array, default: [] }, // dish / action cards shown with an assistant reply
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    source: { type: String, enum: ['ai', 'fallback', 'mock', 'moderation', null], default: null },
    unanswered: { type: Boolean, default: false }, // the assistant said it doesn't know (dashboard: create an FAQ)
    feedback: { type: String, enum: ['up', 'down', null], default: null },
    feedbackNote: { type: String, default: null, set: (v) => (v == null ? v : scrub(v).slice(0, 300)) },
    at: { type: Date, default: Date.now },
});

chatMessageSchema.index({ at: 1 }, { expireAfterSeconds: days() * 24 * 60 * 60 });
chatMessageSchema.index({ sessionId: 1, at: 1 });

module.exports = mongoose.model('chatMessage', chatMessageSchema);
module.exports.scrub = scrub;
