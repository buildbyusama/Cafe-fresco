const mongoose = require('mongoose');

// One row per day (shop timezone): tokens and calls, for the daily budget (A6) and the dashboard cost tile
const aiUsageSchema = new mongoose.Schema({
    day: { type: String, required: true, unique: true }, // YYYY-MM-DD in APP_TZ
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
    embedCalls: { type: Number, default: 0 },
});

module.exports = mongoose.model('aiUsage', aiUsageSchema);
