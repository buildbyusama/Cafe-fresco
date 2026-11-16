// One-off: rebuild averageRating (Number), reviewCount and product.reviews from the reviews collection.
// Fixes the undefined ids the old review route pushed and legacy string ratings. Safe to re-run.
// Usage: node scripts/recalcRatings.js
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/product');
const Review = require('../models/review');

(async () => {
    await mongoose.connect(process.env.DB_URI);
    const stats = await Review.aggregate([
        { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    ]);
    const byProduct = new Map(stats.map((s) => [String(s._id), s]));
    const products = await Product.find().select('_id').lean();
    let updated = 0;
    for (const p of products) {
        const s = byProduct.get(String(p._id));
        await Product.collection.updateOne({ _id: p._id }, {
            $set: {
                averageRating: s ? Math.round(s.avg * 10) / 10 : 0,
                reviewCount: s ? s.count : 0,
                reviews: s ? s.ids : [],
            },
        });
        updated++;
    }
    await Review.syncIndexes();
    console.log(`Recalculated ${updated} products; review indexes synced.`);
    await mongoose.disconnect();
})().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
