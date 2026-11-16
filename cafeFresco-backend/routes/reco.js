const express = require('express');
const router = express.Router();
const { isObjectId } = require('../utils/validation');
const { withStock } = require('../services/productView');
const { anonIdOf, optionalUserId } = require('../services/events');
const reco = require('../services/recommendations');

const send = async (res, ids, extra = {}) => res.json({ ...extra, products: await withStock(await reco.hydrate(ids)) });
const fail = (res, err, what) => {
    console.error(`Recommendations (${what}) failed:`, err);
    res.status(500).json({ message: 'Could not load recommendations' });
};

router.get('/trending', async (req, res) => {
    try {
        await send(res, await reco.trending());
    } catch (err) {
        fail(res, err, 'trending');
    }
});

// The signed-in customer, else the guest cookie; identity never comes from the query or body
router.get('/for-me', async (req, res) => {
    try {
        const { ids, personal } = await reco.forUser({ userId: optionalUserId(req), anonId: anonIdOf(req) });
        res.set('Cache-Control', 'private, no-store');
        await send(res, ids, { personal });
    } catch (err) {
        fail(res, err, 'for-me');
    }
});

router.get('/similar/:id', async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid product id' });
        const ids = await reco.similar(req.params.id);
        if (!ids) return res.status(404).json({ message: 'Product not found' });
        await send(res, ids);
    } catch (err) {
        fail(res, err, 'similar');
    }
});

router.post('/cart', async (req, res) => {
    try {
        const ids = req.body?.productIds;
        if (!Array.isArray(ids) || ids.length > 50 || ids.some((id) => !isObjectId(id))) return res.status(400).json({ message: 'productIds must be up to 50 product ids' });
        await send(res, await reco.withCart(ids));
    } catch (err) {
        fail(res, err, 'cart');
    }
});

module.exports = router;
