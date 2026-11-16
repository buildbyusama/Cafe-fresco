const mongoose = require('mongoose');

// Behaviour signals for recommendations (A10). Kept 180 days.
const userEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    anonId: { type: String, default: null }, // signed cf_anon cookie for guests (no fingerprinting)
    type: { type: String, enum: ['view', 'add_to_cart', 'purchase', 'search', 'chat_reco_click'], required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', default: null },
    quantity: { type: Number, default: 1 },
    query: { type: String, default: null, maxlength: 80 },
    at: { type: Date, default: Date.now },
});

userEventSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
userEventSchema.index({ userId: 1, at: -1 });
userEventSchema.index({ anonId: 1, at: -1 });
userEventSchema.index({ type: 1, productId: 1, at: -1 });

module.exports = mongoose.model('userEvent', userEventSchema);
