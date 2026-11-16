const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const { isObjectId } = require('../utils/validation');
const { createLimiter } = require('../middleware/loginLimiter');
const { ensureAnonId, optionalUserId, record, cleanQuery } = require('../services/events');

const eventLimiter = createLimiter({ windowMs: 60 * 1000, max: 60, message: 'Too many events' });

// Client-reported signals (untrusted): only view and search; the server records cart and purchase itself
router.post('/', eventLimiter, async (req, res) => {
    try {
        const { type, productId, query } = req.body || {};
        if (!['view', 'search'].includes(type)) return res.status(400).json({ message: "type must be 'view' or 'search'" });
        const event = { type };
        if (type === 'view') {
            if (!isObjectId(productId) || !(await Product.exists({ _id: productId, isActive: { $ne: false } }))) return res.status(400).json({ message: 'Unknown product' });
            event.productId = productId;
        } else {
            event.query = cleanQuery(query);
            if (!event.query || event.query.length < 3) return res.status(400).json({ message: 'Search must be at least 3 characters' });
        }
        // identity only from cookies, never from the body
        const userId = optionalUserId(req);
        record({ ...event, userId, anonId: userId ? null : ensureAnonId(req, res) });
        res.status(202).json({ ok: true });
    } catch (err) {
        console.error('Event failed:', err);
        res.status(500).json({ message: 'Could not record the event' });
    }
});

module.exports = router;
