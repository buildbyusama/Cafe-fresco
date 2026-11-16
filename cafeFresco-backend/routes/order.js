const express = require('express');
const orderModel = require('../models/order');
const router = express.Router();
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const isLogged = require('../middleware/isLogged');
const { TZ, now, rangeOf, yearRange, moment: statsMoment } = require('../services/stats');
const userModel = require('../models/user')
const notifyModel = require('../models/notification')
const { StockError } = require('../services/inventoryService')
const { PriceError } = require('../utils/price')
const { OrderError, createOrderFromCart, cancelOrder, markOrderPaid, sweepStaleOrders } = require('../services/orderService')
const mongoose = require('mongoose')
const { isObjectId, escapeRegex } = require('../utils/validation')

const ALLOWED_TRANSITIONS = { pending: ['completed', 'cancelled'] };
const { DiscountError } = require('../services/discountService')



// D2: body is {shippingAddress, discountCode?, paymentMethod}; products/totalAmount/payment are ignored
router.post('/create', isLogged, async (req, res) => {
    sweepStaleOrders();
    try {
        const { shippingAddress, discountCode, paymentMethod } = req.body;
        const idempotencyKey = req.get('Idempotency-Key') || undefined;
        const { order, replayed } = await createOrderFromCart(req.user.userId, { shippingAddress, discountCode, paymentMethod, idempotencyKey });
        res.status(replayed ? 200 : 201).json({ message: 'Order created successfully', order });
    } catch (error) {
        if (error instanceof DiscountError) {
            return res.status(error.status).json({ message: error.message, fields: { discountCode: error.message } });
        }
        if (error instanceof StockError || error instanceof PriceError || error instanceof OrderError) {
            return res.status(error.status).json({ message: error.message, ...(error.productId ? { productId: error.productId } : {}), ...(error.fields ? { fields: error.fields } : {}) });
        }
        console.error("Order creation failed:", error);
        return res.status(500).json({ message: 'Failed to create order' });
    }
});


router.post('/update-status', isAdmin, authorizeRoles("admin", "manager"), async (req, res) => {

    const { orderId, paymentStatus, orderStatus } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order id' });
        }
        if (paymentStatus && !['paid', 'unpaid'].includes(paymentStatus)) {
            return res.status(400).json({ message: 'Invalid payment status value' });
        }
        if (orderStatus && !['pending', 'completed', 'cancelled'].includes(orderStatus)) {
            return res.status(400).json({ message: 'Invalid order status value' });
        }

        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const fromStatus = order.orderStatus;
        const fromPayment = order.paymentStatus;
        const toStatus = orderStatus || fromStatus;
        const toPayment = paymentStatus || fromPayment;

        if (toStatus === fromStatus && toPayment === fromPayment) {
            return res.status(200).json({ message: 'Nothing to change', order });
        }
        // R2: pending → completed | cancelled; completed and cancelled are final
        if (toStatus !== fromStatus && !(ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus)) {
            return res.status(409).json({ message: `A ${fromStatus} order cannot be changed to ${toStatus}` });
        }
        // R3: payment only moves unpaid → paid, and only for a completed order
        if (toPayment !== fromPayment) {
            if (toPayment === 'unpaid') {
                return res.status(409).json({ message: 'A paid order cannot be marked unpaid (refunds are handled outside the dashboard)' });
            }
            if (toStatus !== 'completed') {
                return res.status(409).json({ message: 'Mark the order completed before marking it paid' });
            }
            // D6: card orders are paid only through Stripe confirmation
            if (order.paymentMethod === 'card') {
                return res.status(409).json({ message: 'Card orders are marked paid automatically by Stripe' });
            }
        }

        // a card order is delivered only once Stripe has taken the money
        if (toStatus === 'completed' && order.paymentMethod === 'card' && toPayment !== 'paid') {
            return res.status(409).json({ message: 'This card order is not paid yet. Wait for the payment or cancel it.' });
        }

        // D6: cancelOrder is the only cancel path (stock once, discount released, intent cancelled)
        if (toStatus === 'cancelled') {
            try {
                const cancelled = await cancelOrder(orderId, { byType: 'admin', byId: req.admin.userId, name: req.admin.name });
                return res.status(200).json({ message: 'Order cancelled', order: cancelled });
            } catch (err) {
                if (err instanceof OrderError) return res.status(err.status).json({ message: err.message });
                throw err;
            }
        }

        // Conditional update: a parallel request that already changed the order makes this one fail cleanly
        const updated = await orderModel.findOneAndUpdate(
            { _id: orderId, orderStatus: fromStatus, paymentStatus: fromPayment },
            {
                $set: { orderStatus: toStatus, paymentStatus: toPayment },
                $push: { statusHistory: { from: fromStatus, to: toStatus, paymentFrom: fromPayment, paymentTo: toPayment, byType: 'admin', byId: req.admin.userId, at: new Date() } },
            },
            { new: true, runValidators: true }
        );
        if (!updated) {
            return res.status(409).json({ message: 'Order was changed by someone else. Reload and try again.' });
        }

        const shortId = String(orderId).slice(-6);
        await new notifyModel({
            name: req.admin.name,
            message: `${req.admin.name} set order #${shortId.toUpperCase()} to ${toStatus}/${toPayment}`,
            type: 'order',
            orderId,
        }).save();

        res.status(200).json({ message: 'Order status updated successfully', order: updated });
    } catch (error) {
        console.error('Order status update failed:', error);
        res.status(500).json({ message: 'Failed to update order status' });
    }
});


router.get('/fetch', isAdmin, authorizeRoles("admin", "manager"), async (req, res) => {
    sweepStaleOrders();
    try {
        const { status, paymentStatus, year, month, page = 1, limit = 10, search } = req.query;
        const query = {};

        // Search: a full order id, the short id shown in the dashboard (#A1B2C3, last 6–23 hex chars), or a customer's name/email
        const term = String(search || '').trim().replace(/^#/, '');
        if (term) {
            if (isObjectId(term)) {
                query._id = term;
            } else if (/^[0-9a-f]{6,23}$/i.test(term)) {
                query.$expr = { $regexMatch: { input: { $toString: '$_id' }, regex: `${term.toLowerCase()}$` } };
            } else {
                const rx = new RegExp(escapeRegex(term), 'i');
                const users = await userModel.find({ $or: [{ email: rx }, { name: rx }] }).select('_id').limit(200);
                query.userId = { $in: users.map((u) => u._id) };
            }
        }
        // Date filter in the shop's timezone (same boundaries as the dashboard charts); month without year = this year
        const y = Number(year), m = Number(month);
        if ((year && !(Number.isInteger(y) && y >= 2000 && y <= 2100)) || (month && !(Number.isInteger(m) && m >= 1 && m <= 12))) {
            return res.status(400).json({ message: 'Invalid year or month' });
        }
        if (month) {
            query.createdAt = rangeOf('month', statsMoment.tz({ year: year ? y : now().year(), month: m - 1, day: 1 }, TZ));
        } else if (year) {
            query.createdAt = yearRange(y);
        }

        // ✅ Handle Status Filtering
        if (status) {
            const validStatuses = ['completed', 'cancelled', 'pending'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid order status' });
            }
            query.orderStatus = status;
        }

        // ✅ Handle Payment Status Filtering
        if (paymentStatus) {
            const validPaymentStatuses = ['paid', 'unpaid'];
            if (!validPaymentStatuses.includes(paymentStatus)) {
                return res.status(400).json({ message: 'Invalid payment status' });
            }
            query.paymentStatus = paymentStatus;
        }

        // Pagination: real total, newest first, limit clamped
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const [total, orders] = await Promise.all([
            orderModel.countDocuments(query),
            orderModel.find(query)
                .populate('userId', 'name email')
                .populate('products.productId', 'title price')
                .select('-idempotencyKey')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
        ]);

        // Empty result is a normal 200 (SHARED_DECISIONS D8)
        res.status(200).json({
            success: true,
            message: 'Orders fetched successfully',
            page: pageNum,
            limit: limitNum,
            total,
            totalOrders: total,
            totalPages: Math.max(1, Math.ceil(total / limitNum)),
            orders
        });    } catch (error) {
        console.error('Order fetch failed:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
});



// Admin: one customer's orders (dashboard Users page)
router.get('/history/:userId', isAdmin, authorizeRoles("admin", "manager"), async (req, res) => {
    const { userId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }
        const orders = await orderModel.find({ userId })
            .populate('products.productId', 'title')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ orders });
    } catch (error) {
        console.error('Order history failed:', error);
        res.status(500).json({ message: 'Failed to fetch order history' });
    }
});



// Customer: own orders only; never populate the full user (password hash, reset token)
router.get('/user/history', isLogged, async (req, res) => {
    sweepStaleOrders();
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const filter = { userId: req.user.userId };
        const [total, orders] = await Promise.all([
            orderModel.countDocuments(filter),
            orderModel.find(filter)
                .populate('products.productId', 'title image')
                .select('-idempotencyKey -__v -statusHistory.byId')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        res.status(200).json({ orders, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        console.error('User order history failed:', error);
        res.status(500).json({ message: 'Failed to fetch order history' });
    }
});

// C7: a customer may cancel their own order only while it is pending AND unpaid
router.post('/cancel/:id', isLogged, async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(404).json({ message: 'Order not found' });
        const order = await orderModel.findOne({ _id: req.params.id, userId: req.user.userId });
        // Someone else's order looks the same as a missing one (no info leak)
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.orderStatus !== 'pending' || order.paymentStatus !== 'unpaid') {
            return res.status(409).json({ message: 'This order can no longer be cancelled' });
        }

        // D9: if the card was actually charged, record the payment instead of cancelling
        if (order.stripePaymentIntentId) {
            const intent = await require('stripe')(process.env.STRIPE_SECRET_KEY).paymentIntents.retrieve(order.stripePaymentIntentId).catch(() => null);
            if (intent?.status === 'succeeded') {
                await markOrderPaid(order._id, intent);
                return res.status(409).json({ message: 'This order has been paid' });
            }
            if (intent && ['processing', 'requires_capture'].includes(intent.status)) {
                return res.status(409).json({ message: 'Your payment is being processed. Please try again in a moment.' });
            }
        }

        const user = await userModel.findById(req.user.userId).select('name');
        const cancelled = await cancelOrder(order._id, { byType: 'customer', byId: req.user.userId, name: user?.name });
        res.status(200).json({ message: 'Order cancelled', order: cancelled });
    } catch (error) {
        if (error instanceof OrderError) {
            return res.status(error.status === 403 ? 409 : error.status).json({ message: error.status === 403 || error.status === 409 ? 'This order can no longer be cancelled' : error.message });
        }
        console.error('Customer cancel failed:', error);
        res.status(500).json({ message: 'Failed to cancel order' });
    }
});

// B.6: /set-transaction and /send-order-email removed (the server links payments and sends emails itself, D4)

module.exports = router;