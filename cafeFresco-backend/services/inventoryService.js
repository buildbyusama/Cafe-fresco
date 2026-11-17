const mongoose = require('mongoose');
const Inventory = require('../models/inventory');
const Product = require('../models/product');

class StockError extends Error {
    constructor(message, productId, status = 409) {
        super(message);
        this.productId = productId;
        this.status = status;
    }
}

// Validate and merge order lines: [{productId, quantity}] → unique productIds, integer qty >= 1
function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new StockError('Your cart is empty', null, 400);
    }
    const merged = new Map();
    for (const item of items) {
        const id = String(item?.productId || '');
        const qty = Number(item?.quantity);
        if (!mongoose.Types.ObjectId.isValid(id)) throw new StockError('Invalid product id', id || null, 400);
        if (!Number.isInteger(qty) || qty < 1) throw new StockError('Quantity must be a whole number of at least 1', id, 400);
        merged.set(id, (merged.get(id) || 0) + qty);
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

// Atomic ± change; a decrease never goes below zero. Returns the inventory or null if not enough stock.
async function adjustStock(productId, delta) {
    if (!Number.isInteger(delta)) throw new StockError('Stock change must be a whole number', productId, 400);
    const filter = { productId };
    if (delta < 0) filter.quantityInStock = { $gte: -delta };
    const update = { $inc: { quantityInStock: delta }, $set: { lastUpdated: new Date() } };
    if (delta > 0) update.$set.restockDate = new Date();
    const inv = await Inventory.findOneAndUpdate(filter, update, { new: true });
    if (inv) require('./responseCache').clear(); // stock shown on the menu changed
    return inv;
}

// Absolute value (admin restock/correction); creates the inventory row if missing.
// expected = the stock the admin was looking at: if sales changed it since, refuse instead of overwriting them.
async function setStock(productId, quantity, expected) {
    if (!Number.isInteger(quantity) || quantity < 0) throw new StockError('Stock must be a whole number of 0 or more', productId, 400);
    const current = await Inventory.findOne({ productId });
    if (expected !== undefined && current && current.quantityInStock !== expected) {
        throw new StockError(`Stock changed to ${current.quantityInStock} while you were editing (orders or another admin). Check it and try again.`, productId, 409);
    }
    if (expected !== undefined && current) {
        const update = { quantityInStock: quantity, lastUpdated: new Date(), ...(quantity > expected ? { restockDate: new Date() } : {}) };
        const saved = await Inventory.findOneAndUpdate({ productId, quantityInStock: expected }, { $set: update }, { new: true });
        if (!saved) throw new StockError('Stock changed while you were editing. Check it and try again.', productId, 409);
        return saved;
    }
    const update = { quantityInStock: quantity, lastUpdated: new Date() };
    if (!current || quantity > current.quantityInStock) update.restockDate = new Date();
    return Inventory.findOneAndUpdate({ productId }, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true });
}

// Take stock for every line; if any line is short, give back what was already taken
async function reserveItems(items) {
    const taken = [];
    try {
        for (const { productId, quantity } of items) {
            const updated = await adjustStock(productId, -quantity);
            if (!updated) {
                const product = await Product.findById(productId).select('title');
                if (!product) throw new StockError('Product not found', productId, 404);
                const left = (await Inventory.findOne({ productId }).select('quantityInStock'))?.quantityInStock ?? 0;
                throw new StockError(left > 0 ? `Only ${left} left of ${product.title}` : `${product.title} is out of stock`, productId);
            }
            taken.push({ productId, quantity });
        }
        return taken;
    } catch (err) {
        await restoreItems(taken);
        throw err;
    }
}

async function restoreItems(items) {
    for (const { productId, quantity } of items) {
        await adjustStock(productId, quantity);
    }
}

module.exports = { StockError, normalizeItems, adjustStock, setStock, reserveItems, restoreItems };
