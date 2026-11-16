const mongoose = require('mongoose');

const days = () => Number(process.env.CHAT_RETENTION_DAYS || 30);

// One conversation with the assistant. Removed automatically CHAT_RETENTION_DAYS after the last message (A9).
const chatSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    anonId: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    lastAt: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    escalated: { type: Boolean, default: false },
    language: { type: String, default: null }, // 'en' | 'ur' | 'roman-ur' (last detected)
    summary: { type: String, default: '' }, // running summary of older turns (keeps the prompt short)
    summarizedUpTo: { type: Number, default: 0 },
});

chatSessionSchema.index({ lastAt: 1 }, { expireAfterSeconds: days() * 24 * 60 * 60 });
chatSessionSchema.index({ userId: 1, lastAt: -1 });
chatSessionSchema.index({ anonId: 1, lastAt: -1 });

// Belongs to the signed-in customer, or (guest) to the signed guest cookie
chatSessionSchema.methods.ownedBy = function ({ userId, anonId }) {
    if (this.userId) return !!userId && String(this.userId) === String(userId);
    return !!anonId && this.anonId === anonId;
};

module.exports = mongoose.model('chatSession', chatSessionSchema);
