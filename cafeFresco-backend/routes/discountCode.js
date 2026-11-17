const express = require('express');
const DiscountCode = require('../models/discountCode');
const mongoose = require('mongoose');
const router = express.Router();
const isLogged = require('../middleware/isLogged');
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin')
const Cart = require('../models/cart');
const { StockError, normalizeItems } = require('../services/inventoryService');
const { computeLines, round2, PriceError } = require('../utils/price');
const { DiscountError, validateDiscount } = require('../services/discountService');
const { TZ, moment } = require('../services/stats');

// Validate admin input → { data } or { message, fields }
function parseCode(body, { partial }) {
    const data = {};
    const fields = {};
    if (!partial || body.code !== undefined) {
        data.code = String(body.code || '').trim().toUpperCase();
        if (!/^[A-Z0-9_-]{3,20}$/.test(data.code)) fields.code = 'Code must be 3–20 letters, numbers, - or _';
    }
    if (!partial || body.discountPercentage !== undefined) {
        data.discountPercentage = Number(body.discountPercentage);
        if (!Number.isFinite(data.discountPercentage) || data.discountPercentage < 1 || data.discountPercentage > 100) fields.discountPercentage = 'Discount must be 1–100%';
    }
    if (!partial || body.expiryDate !== undefined) {
        // A date-only value means "valid through that day" in the shop's timezone, not the server's
        const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(body.expiryDate));
        const d = dateOnly ? moment.tz(String(body.expiryDate), 'YYYY-MM-DD', true, TZ).endOf('day').toDate() : new Date(body.expiryDate);
        if (Number.isNaN(d.getTime())) fields.expiryDate = 'Enter a valid expiry date';
        else {
            if (d <= new Date()) fields.expiryDate = 'Expiry date must be in the future';
            data.expiryDate = d;
        }
    }
    if (!partial || body.minPurchase !== undefined) {
        data.minPurchase = body.minPurchase === '' || body.minPurchase == null ? 0 : Number(body.minPurchase);
        if (!Number.isFinite(data.minPurchase) || data.minPurchase < 0) fields.minPurchase = 'Minimum purchase must be 0 or more';
    }
    if (!partial || body.maxUses !== undefined) {
        data.maxUses = Number(body.maxUses);
        if (!Number.isInteger(data.maxUses) || data.maxUses < 1) fields.maxUses = 'Max uses must be a whole number of at least 1';
    }
    if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === 'true';
    if (body.autoApply !== undefined) data.autoApply = body.autoApply === true || body.autoApply === 'true';
    return Object.keys(fields).length ? { message: Object.values(fields)[0], fields } : { data };
}

// ✅ Admin: Create a new discount code
router.post('/create', isAdmin, authorizeRoles("admin"), async (req, res) => {
    try {
        const parsed = parseCode(req.body, { partial: false });
        if (parsed.fields) return res.status(400).json(parsed);
        if (await DiscountCode.exists({ code: parsed.data.code })) {
            return res.status(409).json({ message: 'Discount code already exists', fields: { code: 'Already exists' } });
        }
        const newCode = await DiscountCode.create({ ...parsed.data, usedCount: 0, usedBy: [] });
        res.status(201).json({ message: 'Discount code created successfully', code: newCode });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ message: 'Discount code already exists' });
        console.error('Discount create error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// The code text itself can't change (it may already be in orders)
router.put('/update/:id', isAdmin, authorizeRoles("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
        const { code, ...rest } = req.body;
        const parsed = parseCode(rest, { partial: true });
        if (parsed.fields) return res.status(400).json(parsed);

        const existingCode = await DiscountCode.findById(id);
        if (!existingCode) {
            return res.status(404).json({ message: 'Discount code not found' });
        }
        if (parsed.data.maxUses !== undefined && parsed.data.maxUses < (existingCode.usedCount || 0)) {
            return res.status(400).json({ message: `Max uses can't be below the ${existingCode.usedCount} uses so far`, fields: { maxUses: 'Below current usage' } });
        }

        Object.assign(existingCode, parsed.data);
        await existingCode.save();
        res.status(200).json({ message: 'Discount code updated successfully', code: existingCode });
    } catch (error) {
        console.error('Discount update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Preview only: priced from the server-side cart; nothing is recorded until the order is placed
// Best automatic code for this customer's current server cart (SRS 4.3): among active, unexpired codes marked
// "apply automatically" that they can still use, the biggest saving wins (tie → expires soonest). Preview only;
// the order is still re-validated on the server (D5).
router.post('/best', isLogged, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.userId });
        if (!cart?.items?.length) return res.json({ code: null });
        const items = normalizeItems(cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
        const { subtotal } = await computeLines(items);
        const candidates = await DiscountCode.find({ autoApply: true, isActive: { $ne: false }, expiryDate: { $gt: new Date() } }).sort({ expiryDate: 1 }).limit(50);
        let best = null;
        for (const c of candidates) {
            try {
                const { discount, discountAmount } = await validateDiscount({ code: c.code, userId: req.user.userId, subtotal });
                if (!best || discountAmount > best.discountAmount) best = { code: discount.code, discountAmount };
            } catch (e) {
                if (!(e instanceof DiscountError)) throw e; // used up, already used, below minimum: skip
            }
        }
        res.json(best ? { code: best.code, discountAmount: best.discountAmount, subtotal, total: round2(subtotal - best.discountAmount) } : { code: null });
    } catch (error) {
        if (error instanceof StockError || error instanceof PriceError) return res.json({ code: null });
        console.error('Best discount error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/apply', isLogged, async (req, res) => {
    try {
        const { code } = req.body; // cartTotal is ignored (D5)
        const userId = req.user.userId;

        const cart = await Cart.findOne({ userId });
        const items = normalizeItems((cart?.items || []).map((i) => ({ productId: i.productId, quantity: i.quantity })));
        const { subtotal } = await computeLines(items);
        const { discount, discountAmount } = await validateDiscount({ code, userId, subtotal });
        const total = round2(subtotal - discountAmount);

        res.status(200).json({
            message: 'Discount applied',
            code: discount.code,
            subtotal,
            discountAmount,
            total
        });
    } catch (error) {
        if (error instanceof DiscountError || error instanceof StockError || error instanceof PriceError) {
            return res.status(error.status).json({ message: error.message });
        }
        console.error('Discount apply error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ Admin: Delete a discount code
router.delete('/delete/:id', isAdmin, authorizeRoles("admin"), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
        const deleted = await DiscountCode.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Discount code not found' });
        res.json({ message: 'Discount code deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/fetch', isAdmin, authorizeRoles("admin"), async (req, res) => {

    try {

        const allCode = await DiscountCode.find();
        res.status(200).json({ allCode });

    } catch (error) {
        res.status(500).json({ message: 'Server Error ' })
    }
})


module.exports = router;
