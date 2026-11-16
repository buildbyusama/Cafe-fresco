const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    products: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
        quantity: { type: Number, required: true },
        // Price snapshot at order time (optional so legacy orders still load)
        title: { type: String },
        unitPrice: { type: Number },
        lineTotal: { type: Number },
    }],
    subtotal: { type: Number },
    discountCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    // Optional at schema level so legacy orders load; required by /order/create
    shippingAddress: {
        fullName: String,
        phone: String,
        city: String,
        zip: String,
        line1: String,
    },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    paymentMethod: { type: String, enum: ['card', 'cod'], default: 'cod' },
    orderStatus: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'payment',
        default: null,
    },
    stripePaymentIntentId: { type: String, default: null },
    // Client-supplied Idempotency-Key: a retried request returns the same order
    idempotencyKey: { type: String, default: undefined },
    // Set when a cancelled order's stock has been returned (guards against double restore)
    stockRestored: { type: Boolean, default: false },
    statusHistory: [{
        from: String,
        to: String,
        paymentFrom: String,
        paymentTo: String,
        byType: { type: String, enum: ['admin', 'customer', 'system'] },
        byId: { type: mongoose.Schema.Types.ObjectId },
        at: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

orderSchema.index(
    { userId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('order', orderSchema);
