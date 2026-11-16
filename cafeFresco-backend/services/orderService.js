// The only code paths that create, cancel or pay orders (SHARED_DECISIONS D2, D3, D6, D9)
const Order = require('../models/order');
const Cart = require('../models/cart');
const Payment = require('../models/payment');
const Notify = require('../models/notification');
const User = require('../models/user');
const sendOrderMail = require('../config/sendMail');
const { round2, computeLines } = require('../utils/price');
const { validateShippingAddress } = require('../utils/validation');
const { normalizeItems, reserveItems, restoreItems } = require('./inventoryService');
const { validateDiscount, redeemDiscount, releaseDiscount } = require('./discountService');
const { record: recordEvents } = require('./events');

const stripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);

class OrderError extends Error {
    constructor(message, status = 400, extra = {}) {
        super(message);
        this.status = status;
        Object.assign(this, extra);
    }
}

const notifyAdmins = (name, message, orderId = null) => new Notify({ name, message, type: 'order', orderId }).save().catch(() => {});

const mailOrder = async (order, userId) => {
    try {
        const user = await User.findById(userId).select('email name');
        if (user) await sendOrderMail(order, user);
    } catch (err) {
        console.error('Order email failed:', err.message);
    }
};

// D2: validate → reserve stock → redeem code → save → clear cart; undo in reverse on failure
async function createOrderFromCart(userId, { shippingAddress, discountCode, paymentMethod, idempotencyKey }) {
    if (idempotencyKey) {
        const existing = await Order.findOne({ userId, idempotencyKey });
        if (existing) return { order: existing, replayed: true };
    }

    const method = String(paymentMethod || '').toLowerCase();
    if (!['card', 'cod'].includes(method)) throw new OrderError('Choose card or cash on delivery', 400, { fields: { paymentMethod: 'Invalid payment method' } });
    const address = validateShippingAddress(shippingAddress);
    if (address.fields) throw new OrderError('Please check your delivery details', 400, { fields: address.fields });

    const user = await User.findById(userId).select('name cart');
    const cart = user?.cart ? await Cart.findById(user.cart) : await Cart.findOne({ userId });
    const items = normalizeItems((cart?.items || []).map((i) => ({ productId: i.productId, quantity: i.quantity })));
    const { lines, subtotal } = await computeLines(items);

    let discount = null;
    let discountAmount = 0;
    if (discountCode) ({ discount, discountAmount } = await validateDiscount({ code: discountCode, userId, subtotal }));

    let reserved = [];
    let redeemed = false;
    try {
        reserved = await reserveItems(items);
        if (discount) {
            await redeemDiscount({ discountId: discount._id, userId });
            redeemed = true;
        }

        const order = await Order.create({
            userId,
            products: lines,
            subtotal,
            discountCode: discount ? discount.code : null,
            discountAmount,
            totalAmount: round2(Math.max(0, subtotal - discountAmount)),
            shippingAddress: address.value,
            paymentMethod: method,
            paymentStatus: 'unpaid',
            orderStatus: 'pending',
            ...(idempotencyKey ? { idempotencyKey } : {}),
        });

        if (cart) {
            cart.items = [];
            await cart.save();
        }

        // COD: payment record + link + email in the same request
        if (method === 'cod') {
            const payment = await Payment.create({
                orderId: order._id, userId, paymentMethod: 'COD', transactionId: `cod_${order._id}`, amount: order.totalAmount, paymentStatus: 'Pending',
            });
            order.paymentId = payment._id;
            await order.save();
            mailOrder(order, userId);
        }

        notifyAdmins(user?.name || 'Customer', `New order #${String(order._id).slice(-6).toUpperCase()} from ${user?.name || 'a customer'}`, order._id);
        // one purchase signal per line, only for a new order (replays return earlier)
        recordEvents(order.products.map((l) => ({ userId, type: 'purchase', productId: l.productId, quantity: l.quantity })));
        return { order, replayed: false };
    } catch (err) {
        if (redeemed) await releaseDiscount({ discountId: discount._id, userId });
        if (reserved.length) await restoreItems(reserved);
        if (err?.code === 11000 && idempotencyKey) {
            const existing = await Order.findOne({ userId, idempotencyKey });
            if (existing) return { order: existing, replayed: true };
        }
        throw err;
    }
}

// D6: the only cancel path. actor = { byType: 'admin'|'customer'|'system', byId, name }
async function cancelOrder(orderId, actor) {
    const current = await Order.findById(orderId);
    if (!current) throw new OrderError('Order not found', 404);
    if (current.orderStatus !== 'pending') throw new OrderError(`A ${current.orderStatus} order cannot be cancelled`, 409);
    if (actor.byType === 'customer' && (String(current.userId) !== String(actor.byId) || current.paymentStatus !== 'unpaid')) {
        throw new OrderError('Only your own unpaid orders can be cancelled', 403);
    }

    const order = await Order.findOneAndUpdate(
        { _id: orderId, orderStatus: 'pending' },
        {
            $set: { orderStatus: 'cancelled' },
            $push: { statusHistory: { from: 'pending', to: 'cancelled', paymentFrom: current.paymentStatus, paymentTo: current.paymentStatus, byType: actor.byType, byId: actor.byId, at: new Date() } },
        },
        { new: true }
    );
    if (!order) throw new OrderError('Order was changed by someone else. Reload and try again.', 409);

    // Stock back exactly once
    const claimed = await Order.findOneAndUpdate({ _id: orderId, stockRestored: { $ne: true } }, { $set: { stockRestored: true } }, { new: true });
    if (claimed) {
        await restoreItems(claimed.products.map((p) => ({ productId: p.productId, quantity: p.quantity })));
        order.stockRestored = true;
    }

    if (order.discountCode) {
        const DiscountCode = require('../models/discountCode');
        const code = await DiscountCode.findOne({ code: order.discountCode });
        if (code) await releaseDiscount({ discountId: code._id, userId: order.userId });
    }

    if (order.stripePaymentIntentId && order.paymentStatus === 'unpaid') {
        try {
            const intent = await stripe().paymentIntents.retrieve(order.stripePaymentIntentId);
            if (!['succeeded', 'canceled'].includes(intent.status)) await stripe().paymentIntents.cancel(intent.id);
        } catch (err) {
            console.error('Could not cancel payment intent:', err.message);
        }
    }

    const who = actor.byType === 'system' ? 'System' : actor.name || actor.byType;
    notifyAdmins(who, `${who} cancelled order #${String(orderId).slice(-6).toUpperCase()}`, orderId);
    return order;
}

// D3: idempotent — one Payment per transaction, order paid once, one email
async function markOrderPaid(orderId, intent) {
    const order = await Order.findById(orderId);
    if (!order) throw new OrderError('Order not found', 404);

    let payment = await Payment.findOne({ transactionId: intent.id });
    if (!payment) {
        try {
            payment = await Payment.create({
                orderId: order._id,
                userId: order.userId,
                paymentMethod: 'Debit Card',
                transactionId: intent.id,
                amount: order.totalAmount,
                paymentStatus: 'Completed',
                paymentDetails: { id: intent.id, status: intent.status, amount: intent.amount_received, currency: intent.currency },
            });
        } catch (err) {
            if (err?.code !== 11000) throw err;
            payment = await Payment.findOne({ transactionId: intent.id });
        }
    }

    const updated = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: 'unpaid' },
        {
            $set: { paymentStatus: 'paid', paymentId: payment._id, stripePaymentIntentId: intent.id },
            $push: { statusHistory: { from: order.orderStatus, to: order.orderStatus, paymentFrom: 'unpaid', paymentTo: 'paid', byType: 'system', at: new Date() } },
        },
        { new: true }
    );
    if (updated) {
        if (updated.orderStatus === 'cancelled') {
            // the card was charged after the order was cancelled (stock already went back): a person must refund it
            notifyAdmins('System', `Order #${String(updated._id).slice(-6).toUpperCase()} was paid after it was cancelled — refund it in Stripe`, updated._id);
        } else {
            mailOrder(updated, updated.userId);
        }
        return { order: updated, payment };
    }
    return { order: await Order.findById(order._id), payment };
}

// D9: lazy cleanup (no background jobs on Vercel); at most once per 60 s per instance
let lastSweep = 0;
async function cancelStaleUnpaidCardOrders({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastSweep < 60 * 1000) return 0;
    lastSweep = now;

    const minutes = Number(process.env.STALE_CARD_ORDER_MIN || 30);
    const stale = await Order.find({ paymentMethod: 'card', paymentStatus: 'unpaid', orderStatus: 'pending', createdAt: { $lt: new Date(now - minutes * 60000) } });
    let cancelled = 0;
    for (const order of stale) {
        try {
            if (order.stripePaymentIntentId) {
                const intent = await stripe().paymentIntents.retrieve(order.stripePaymentIntentId);
                if (intent.status === 'succeeded') {
                    await markOrderPaid(order._id, intent); // paid but the confirm call was lost: never cancel
                    continue;
                }
                if (['processing', 'requires_action'].includes(intent.status)) continue;
            }
            await cancelOrder(order._id, { byType: 'system' });
            cancelled++;
        } catch (err) {
            console.error(`Stale order ${order._id} cleanup failed:`, err.message);
        }
    }
    return cancelled;
}

// Fire-and-forget hook for request handlers
const sweepStaleOrders = () => {
    cancelStaleUnpaidCardOrders().catch((err) => console.error('Stale order sweep failed:', err.message));
};

module.exports = { OrderError, createOrderFromCart, cancelOrder, markOrderPaid, cancelStaleUnpaidCardOrders, sweepStaleOrders };
