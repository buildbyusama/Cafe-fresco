const mongoose = require('mongoose');

// One document (key 'store'): the shop facts the website and the AI assistant read (A1: never invented).
// Empty means "not provided": the site hides it and the assistant says it doesn't know.
const hourSchema = new mongoose.Schema(
    {
        day: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
        open: { type: String, default: '' }, // 'HH:mm'
        close: { type: String, default: '' }, // 'HH:mm'; earlier than open = closes after midnight
        closed: { type: Boolean, default: false },
    },
    { _id: false }
);

const settingSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'store', unique: true },
        contact: {
            phone: { type: String, default: '' },
            email: { type: String, default: '' },
            address: { type: String, default: '' },
            mapUrl: { type: String, default: '' },
        },
        hours: { type: [hourSchema], default: [] },
        delivery: {
            areas: { type: [String], default: [] },
            fee: { type: Number, default: 0 }, // the server charges no delivery fee today
            minOrder: { type: Number, default: 0 },
            etaMinutes: { type: Number, default: null },
        },
        payments: {
            card: { type: Boolean, default: true },
            cod: { type: Boolean, default: true },
        },
        policies: {
            cancellation: { type: String, default: '' },
            refunds: { type: String, default: '' },
            delivery: { type: String, default: '' },
        },
        social: {
            facebook: { type: String, default: '' },
            instagram: { type: String, default: '' },
            twitter: { type: String, default: '' },
        },
        chatbot: {
            enabled: { type: Boolean, default: true },
            greeting: { type: String, default: "Hi! I'm the Cafe Fresco assistant. Ask me about our menu, deals or your order." },
            escalationEmail: { type: String, default: '' },
            dailyTokenBudget: { type: Number, default: null }, // null = use AI_DAILY_TOKEN_BUDGET
            hiddenOn: { type: [String], default: ['/address', '/payment'] },
        },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('setting', settingSchema);
