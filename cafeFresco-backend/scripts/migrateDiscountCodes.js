// One-off data fixes for SHARED_DECISIONS D2/D5. Safe to run more than once. Usage: node scripts/migrateDiscountCodes.js
require('dotenv').config();
const mongoose = require('mongoose');
const DiscountCode = require('../models/discountCode');
const Order = require('../models/order');

(async () => {
    await mongoose.connect(process.env.DB_URI);

    let codes = 0;
    for (const d of await DiscountCode.find().lean()) {
        const usedBy = (d.usedBy || []).filter(Boolean);
        await DiscountCode.collection.updateOne(
            { _id: d._id },
            { $set: { code: String(d.code).trim().toUpperCase(), usedBy, usedCount: usedBy.length, isActive: d.isActive !== false } }
        );
        codes++;
    }

    // Orders: paymentMethod is lowercase 'card' | 'cod'
    const upper = await Order.collection.updateMany({ paymentMethod: 'COD' }, { $set: { paymentMethod: 'cod' } });
    const missing = await Order.collection.updateMany({ paymentMethod: { $exists: false } }, { $set: { paymentMethod: 'cod' } });

    console.log(`Discount codes normalised: ${codes}; orders fixed: ${upper.modifiedCount + missing.modifiedCount}`);
    await mongoose.disconnect();
})().catch(async (e) => {
    console.error('Migration failed:', e.message);
    await mongoose.disconnect();
    process.exit(1);
});
