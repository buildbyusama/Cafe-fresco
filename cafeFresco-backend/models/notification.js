const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    name: { type: String },
    message: { type: String, required: true },
    type: { type: String, enum: ['order', 'permission', 'settings', 'chat_escalation', 'ai_error', 'system_error', 'payment_issue'], required: true },
    // Order the notification is about (order notifications only) — the dashboard links to it
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'order', default: null },
    // Dashboard page the notification opens (e.g. /admin/ai-insights?session=…); null = no link
    link: { type: String, default: null },
    // Same key within the dedupe window = one notification (alerts must not flood the bell)
    key: { type: String, default: null },
    time: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false }, // legacy global flag, no longer used
    // Read state per admin: one admin reading doesn't hide it for the others
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'admin' }]
});

module.exports = mongoose.model('notification', notificationSchema);
