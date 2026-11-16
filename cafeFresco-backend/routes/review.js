const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const reviewModal = require('../models/review');
const productModal = require('../models/product');
const orderModel = require('../models/order');
const isLogged = require('../middleware/isLogged');

// Recompute averageRating (1 decimal) and reviewCount from the reviews collection
const recalcProductRating = async (productId) => {
    const [agg] = await reviewModal.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await productModal.updateOne({ _id: productId }, {
        $set: { averageRating: agg ? Math.round(agg.avg * 10) / 10 : 0, reviewCount: agg ? agg.count : 0 },
    });
};

const firstName = (user) => (user?.name || '').trim().split(/\s+/)[0] || 'Customer';

// Add a review: only a customer with a completed order containing the product, once (rule C6)
router.post('/add/:productId', isLogged, async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.userId;
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'Invalid product id' });

        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Choose a rating from 1 to 5' });
        const text = typeof req.body.review === 'string' ? req.body.review.trim() : '';
        if (text.length < 3 || text.length > 1000) return res.status(400).json({ message: 'Review must be 3–1000 characters' });

        if (!(await productModal.exists({ _id: productId }))) return res.status(404).json({ message: 'Product not found' });

        const bought = await orderModel.exists({ userId, orderStatus: 'completed', 'products.productId': productId });
        if (!bought) return res.status(403).json({ message: 'You can review products you have received' });

        if (await reviewModal.exists({ user: userId, product: productId })) {
            return res.status(409).json({ message: 'You have already reviewed this product' });
        }

        const newReview = await reviewModal.create({ user: userId, product: productId, rating, review: text });
        await productModal.updateOne({ _id: productId }, { $addToSet: { reviews: newReview._id } });
        await recalcProductRating(productId);

        const user = await mongoose.model('user').findById(userId).select('name');
        res.status(201).json({
            message: 'Review added successfully',
            review: { _id: newReview._id, name: firstName(user), rating, review: text, createdAt: newReview.createdAt },
        });
    } catch (error) {
        // Parallel submits: the unique index rejects the second one
        if (error?.code === 11000) return res.status(409).json({ message: 'You have already reviewed this product' });
        console.error('Review add error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Public review list: first name only, never the email (rule C6)
router.get('/all/:productId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.productId)) return res.status(400).json({ message: 'Invalid product id' });
        const reviews = await reviewModal.find({ product: req.params.productId })
            .populate('user', 'name')
            .select('user review rating createdAt')
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(reviews.map((r) => ({ _id: r._id, name: firstName(r.user), rating: r.rating, review: r.review, createdAt: r.createdAt })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
module.exports.recalcProductRating = recalcProductRating;
