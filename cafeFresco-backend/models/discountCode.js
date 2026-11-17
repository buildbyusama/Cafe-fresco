const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    discountPercentage: { type: Number, required: true, min: 1, max: 100 },
    expiryDate: { type: Date, required: true },
    minPurchase: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // applied for the customer at checkout when it's the best code they can use (they can remove it)
    autoApply: { type: Boolean, default: false },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }]
});

module.exports = mongoose.model('discountCode', discountCodeSchema);
