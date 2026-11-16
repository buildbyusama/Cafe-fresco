// The customer's own orders and cart, an add-to-cart proposal (the UI asks to confirm; A4) and a
// discount-code check. Identity always comes from ctx (the session cookie), never from arguments (A3).
const mongoose = require('mongoose');
const Order = require('../../../models/order');
const Cart = require('../../../models/cart');
const Product = require('../../../models/product');
const Inventory = require('../../../models/inventory');
const { unitPrice, computeLines, round2, PriceError } = require('../../../utils/price');
const { normalizeItems, StockError } = require('../../inventoryService');
const { validateDiscount, DiscountError } = require('../../discountService');

const LOGIN = { error: 'login_required', message: 'The customer needs to log in first.' };
const shortId = (id) => String(id).slice(-6).toUpperCase();

const orderView = (o) => ({
    shortId: shortId(o._id),
    status: o.orderStatus,
    payment: o.paymentStatus,
    method: o.paymentMethod === 'card' ? 'card' : 'cash on delivery',
    total: o.totalAmount,
    items: (o.products || []).slice(0, 6).map((l) => `${l.quantity} × ${l.title || 'item'}`),
    placed: o.createdAt,
    trackUrl: `/track?order=${o._id}`,
});

module.exports = [
    {
        name: 'get_my_orders',
        description: "The logged-in customer's latest orders with status and payment.",
        requiresLogin: true,
        parameters: { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 5 } } },
        async handler({ limit = 3 }, ctx) {
            if (!ctx.userId) return { data: LOGIN };
            const orders = await Order.find({ userId: ctx.userId }).sort({ createdAt: -1 }).limit(limit).lean();
            return { data: { orders: orders.map(orderView) } };
        },
    },
    {
        name: 'get_order_status',
        description: 'Status of one of the customer\'s orders by its short id (the 6 characters after #, e.g. A1B2C3).',
        requiresLogin: true,
        parameters: { type: 'object', additionalProperties: false, required: ['shortId'], properties: { shortId: { type: 'string' } } },
        async handler({ shortId: sid }, ctx) {
            if (!ctx.userId) return { data: LOGIN };
            const clean = String(sid || '').replace(/^#/, '').trim().toLowerCase();
            if (!/^[0-9a-f]{6}$/.test(clean)) return { data: { error: 'bad_request', message: 'Order numbers are 6 characters like A1B2C3.' } };
            // only this customer's orders: someone else's order looks exactly like a missing one
            const orders = await Order.find({ userId: ctx.userId, $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${clean}$` } } }).sort({ createdAt: -1 }).limit(3).lean();
            if (!orders.length) return { data: { orders: [], message: `No order #${clean.toUpperCase()} on this account.` } };
            return { data: { orders: orders.map(orderView), ...(orders.length > 1 ? { note: 'More than one order matches; ask which one by date.' } : {}) } };
        },
    },
    {
        name: 'get_my_cart',
        description: "What is in the logged-in customer's cart right now, with the subtotal.",
        requiresLogin: true,
        parameters: { type: 'object', additionalProperties: false, properties: {} },
        async handler(args, ctx) {
            if (!ctx.userId) return { data: LOGIN };
            const cart = await Cart.findOne({ userId: ctx.userId }).populate('items.productId', 'title price discount isActive').lean();
            const lines = (cart?.items || []).filter((i) => i.productId);
            const stock = new Map((await Inventory.find({ productId: { $in: lines.map((i) => i.productId._id) } }).lean()).map((r) => [String(r.productId), r.quantityInStock]));
            const view = lines.map((i) => {
                const left = stock.get(String(i.productId._id)) ?? 0;
                const reason = i.productId.isActive === false ? 'no longer available' : left <= 0 ? 'out of stock' : left < i.quantity ? `only ${left} left` : null;
                return { title: i.productId.title, quantity: i.quantity, unitPrice: unitPrice(i.productId), ...(reason ? { problem: reason } : {}) };
            });
            const subtotal = round2(view.filter((l) => !l.problem).reduce((n, l) => n + l.unitPrice * l.quantity, 0));
            return { data: { lines: view, subtotal, cartUrl: '/cart' } };
        },
    },
    {
        name: 'propose_add_to_cart',
        description: 'Offer to add a dish to the cart. This does NOT add it: the customer must tap Confirm in the chat. Use the dish id from search results.',
        requiresLogin: true,
        parameters: {
            type: 'object',
            additionalProperties: false,
            required: ['productId', 'quantity'],
            properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10 } },
        },
        async handler({ productId, quantity }, ctx) {
            if (!ctx.userId) return { data: LOGIN };
            if (!mongoose.Types.ObjectId.isValid(productId)) return { data: { error: 'not_found', message: 'That dish was not found.' } };
            const p = await Product.findOne({ _id: productId, isActive: { $ne: false } }).lean();
            if (!p) return { data: { error: 'not_found', message: 'That dish is not on the menu.' } };
            const left = (await Inventory.findOne({ productId }).lean())?.quantityInStock ?? 0;
            if (left <= 0) return { data: { error: 'out_of_stock', message: `${p.title} is out of stock.` } };
            const qty = Math.min(Number(quantity) || 1, left, 10);
            const card = { type: 'add_to_cart', productId: String(p._id), quantity: qty, title: p.title, price: unitPrice(p), image: p.image || '' };
            return { data: { proposed: true, title: p.title, quantity: qty, ...(qty < quantity ? { note: `only ${left} left` } : {}), message: 'Waiting for the customer to tap Confirm.' }, cards: [card] };
        },
    },
    {
        name: 'check_discount_code',
        description: "Check whether a discount code works for the customer's current cart (preview only, nothing is applied).",
        requiresLogin: true,
        parameters: { type: 'object', additionalProperties: false, required: ['code'], properties: { code: { type: 'string' } } },
        async handler({ code }, ctx) {
            if (!ctx.userId) return { data: LOGIN };
            try {
                const cart = await Cart.findOne({ userId: ctx.userId }).lean();
                const items = normalizeItems((cart?.items || []).map((i) => ({ productId: i.productId, quantity: i.quantity })));
                const { subtotal } = await computeLines(items);
                const { discount, discountAmount } = await validateDiscount({ code, userId: ctx.userId, subtotal });
                return { data: { valid: true, code: discount.code, discountAmount, newTotal: round2(subtotal - discountAmount), note: 'Apply it on the cart page.' } };
            } catch (err) {
                if (err instanceof DiscountError || err instanceof StockError || err instanceof PriceError) return { data: { valid: false, message: err.message } };
                throw err;
            }
        },
    },
];
