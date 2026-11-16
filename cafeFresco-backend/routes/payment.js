const express = require('express');
const mongoose = require('mongoose');
const isLogged = require('../middleware/isLogged');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const Payment = require('../models/payment')
const Order = require('../models/order')
const { markOrderPaid, sweepStaleOrders } = require('../services/orderService');

const CURRENCY = (process.env.CURRENCY || process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
const toCents = (amount) => Math.round(Number(amount) * 100);

// Load an order that belongs to the logged-in customer
async function ownOrder(orderId, userId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return null;
    return Order.findOne({ _id: orderId, userId });
}

// D3.1: one intent per order; retries get the same intent back
router.post('/payment-intent', isLogged, async (req, res) => {
    sweepStaleOrders();
    const { orderId } = req.body;

    try {
        const order = await ownOrder(orderId, req.user.userId);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.paymentMethod !== 'card') return res.status(409).json({ message: 'This order is cash on delivery' });
        if (order.paymentStatus === 'paid') return res.status(409).json({ message: 'Order is already paid' });
        if (order.orderStatus !== 'pending') return res.status(409).json({ message: `Order is ${order.orderStatus}` });

        if (order.stripePaymentIntentId) {
            const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
            if (existing.status === 'succeeded') {
                await markOrderPaid(order._id, existing);
                return res.status(409).json({ message: 'Order is already paid' });
            }
            if (existing.status !== 'canceled') {
                return res.status(200).json({ clientSecret: existing.client_secret, amount: order.totalAmount });
            }
        }

        const intent = await stripe.paymentIntents.create({
            amount: toCents(order.totalAmount),
            currency: CURRENCY,
            // The shop only has a card form (CardElement); redirect-based methods can't complete
            payment_method_types: ['card'],
            metadata: { orderId: String(order._id), userId: String(req.user.userId) },
        });
        await Order.updateOne({ _id: order._id }, { $set: { stripePaymentIntentId: intent.id } });

        res.status(200).json({ clientSecret: intent.client_secret, amount: order.totalAmount });
    } catch (error) {
        console.error('Payment intent error:', error.message);
        res.status(500).json({ message: 'Could not start the payment. Please try again.' });
    }
});


// D3.3: the server checks Stripe before marking the order paid
router.post('/confirm', isLogged, async (req, res) => {
    const { paymentIntentId } = req.body;
    const userId = req.user.userId;

    try {
        if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
            return res.status(400).json({ message: 'Invalid payment intent' });
        }

        let intent;
        try {
            intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        } catch {
            return res.status(400).json({ message: 'Payment not found' });
        }

        const order = await ownOrder(intent.metadata?.orderId, userId);
        if (!order || intent.metadata?.userId !== String(userId)) {
            return res.status(403).json({ message: 'This payment does not belong to your order' });
        }
        if (intent.status !== 'succeeded') {
            return res.status(402).json({ message: 'Payment has not succeeded' });
        }
        if (intent.amount_received !== toCents(order.totalAmount) || intent.currency !== CURRENCY) {
            return res.status(409).json({ message: 'Paid amount does not match the order total' });
        }

        const result = await markOrderPaid(order._id, intent);
        res.status(200).json({ message: 'Payment confirmed', order: result.order, payment: result.payment });
    } catch (error) {
        console.error('Payment confirm error:', error.message);
        res.status(500).json({ message: 'Could not confirm the payment' });
    }
});


// Stripe webhook: marks the order paid even if the customer closed the tab before /confirm.
// Mounted in app.js with a raw body (signature check needs the exact bytes). Off unless STRIPE_WEBHOOK_SECRET is set.
const webhook = async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(404).json({ message: 'Not found' });
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
    } catch (err) {
        return res.status(400).json({ message: `Webhook signature failed: ${err.message}` });
    }
    try {
        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object;
            const order = mongoose.Types.ObjectId.isValid(intent.metadata?.orderId) ? await Order.findById(intent.metadata.orderId) : null;
            if (order && intent.amount_received === toCents(order.totalAmount) && intent.currency === CURRENCY) {
                await markOrderPaid(order._id, intent);
            } else if (order) {
                console.error(`Webhook: amount/currency mismatch for order ${order._id}`);
            }
        }
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handling failed:', error.message);
        res.status(500).json({ message: 'Webhook handling failed' }); // Stripe retries
    }
};

// B.6: /payment/create removed (COD payments are created inside /order/create, D4)

module.exports = router;
module.exports.webhook = webhook;
