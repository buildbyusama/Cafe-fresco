const DiscountCode = require('../models/discountCode');
const { round2 } = require('../utils/price');

class DiscountError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

// Read-only check: is this code usable by this user for this subtotal? → { discount, discountAmount }
async function validateDiscount({ code, userId, subtotal }) {
    const normalized = normalizeCode(code);
    if (!normalized) throw new DiscountError('Discount code is required');

    // Case-insensitive match also covers codes saved before codes were uppercased
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const discount = await DiscountCode.findOne({ code: { $regex: `^${escaped}$`, $options: 'i' } });
    if (!discount || discount.isActive === false) throw new DiscountError('Invalid discount code');
    if (new Date() > new Date(discount.expiryDate)) throw new DiscountError('Discount code has expired');
    if ((discount.usedCount || 0) >= (discount.maxUses || 1)) throw new DiscountError('Discount code has reached its usage limit');
    if (discount.usedBy.some((id) => String(id) === String(userId))) throw new DiscountError('You have already used this discount code');
    if (subtotal < (discount.minPurchase || 0)) throw new DiscountError(`Minimum purchase should be ${discount.minPurchase}`);

    const discountAmount = round2((subtotal * discount.discountPercentage) / 100);
    return { discount, discountAmount };
}

// Atomic redemption: guarded so parallel orders can't exceed maxUses or reuse per user
async function redeemDiscount({ discountId, userId }) {
    const updated = await DiscountCode.findOneAndUpdate(
        { _id: discountId, usedBy: { $ne: userId }, $expr: { $lt: [{ $ifNull: ['$usedCount', 0] }, { $ifNull: ['$maxUses', 1] }] } },
        { $inc: { usedCount: 1 }, $addToSet: { usedBy: userId } },
        { new: true }
    );
    if (!updated) throw new DiscountError('Discount code is no longer available', 409);
    return updated;
}

async function releaseDiscount({ discountId, userId }) {
    await DiscountCode.updateOne({ _id: discountId, usedBy: userId }, { $inc: { usedCount: -1 }, $pull: { usedBy: userId } });
}

module.exports = { DiscountError, normalizeCode, validateDiscount, redeemDiscount, releaseDiscount };
