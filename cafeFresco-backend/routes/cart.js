const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const userModel = require('../models/user');
const isLogged = require('../middleware/isLogged');
const cartModel = require('../models/cart')
const productModel = require('../models/product')
const { unitPrice } = require('../utils/price')
const Inventory = require('../models/inventory')

const MAX_QTY = 99;

// Quantity must be a whole number 1..99 (strings like "2" are accepted, "1.5" / "x" / 0 are not)
const parseQty = (q) => {
    const n = typeof q === 'string' && q.trim() !== '' ? Number(q) : q;
    return Number.isInteger(n) && n >= 1 && n <= MAX_QTY ? n : null;
};

const stockOfProduct = async (productId) => (await Inventory.findOne({ productId }).select('quantityInStock'))?.quantityInStock ?? 0;

// The user's cart, created and linked on first use; null if the user no longer exists
const getOrCreateCart = async (userId) => {
    const user = await userModel.findById(userId);
    if (!user) return null;
    let cart = user.cart ? await cartModel.findById(user.cart) : null;
    if (!cart) cart = await cartModel.findOne({ userId: user._id });
    if (!cart) cart = await cartModel.create({ userId: user._id, items: [] });
    if (String(user.cart) !== String(cart._id)) { user.cart = cart._id; await user.save(); }
    return cart;
};

// One response shape for every cart endpoint.
// D7: deleted products are dropped (cart saved, count reported); inactive or short-stock items stay, marked unavailable.
const formatCart = async (cart) => {
    if (!cart || cart.items.length === 0) return { cart: [], removedCount: 0 };
    await cart.populate({
        path: 'items.productId',
        select: 'price discount image category title isActive',
        populate: { path: 'category', select: 'title' }
    });

    const kept = cart.items.filter(item => item.productId);
    const removedCount = cart.items.length - kept.length;
    if (removedCount) {
        await cartModel.updateOne({ _id: cart._id }, { $pull: { items: { productId: { $nin: kept.map(i => i.productId._id) } } } });
    }

    // Stock by productId (same source the order service reserves from)
    const stockRows = await Inventory.find({ productId: { $in: kept.map(i => i.productId._id) } }).select('productId quantityInStock');
    const stockOf = new Map(stockRows.map(s => [String(s.productId), s.quantityInStock]));

    const items = kept.map(item => {
        const p = item.productId;
        const inStock = stockOf.get(String(p._id)) ?? 0;
        let reason = null;
        if (p.isActive === false) reason = 'No longer available';
        else if (inStock <= 0) reason = 'Out of stock';
        else if (inStock < item.quantity) reason = `Only ${inStock} left`;
        return {
            productId: p._id,
            price: unitPrice(p),
            originalPrice: p.price,
            discount: p.discount || 0,
            image: p.image,
            category: p.category,
            title: p.title,
            quantity: item.quantity,
            inStock,
            available: !reason,
            reason
        };
    });
    return { cart: items, removedCount };
};

router.post('/add', isLogged, async (req, res) => {
    try {
        const { productId } = req.body;
        const quantity = parseQty(req.body.quantity);
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: "Invalid product id" });
        if (!quantity) return res.status(400).json({ message: `Quantity must be a whole number from 1 to ${MAX_QTY}` });

        const product = await productModel.findById(productId).select('isActive');
        if (!product || product.isActive === false) return res.status(404).json({ message: "Product not found" });

        const cart = await getOrCreateCart(req.user.userId);
        if (!cart) return res.status(404).json({ message: "User not found" });

        const stock = await stockOfProduct(productId);
        const existing = cart.items.find(item => item.productId.toString() === productId);
        const newQty = (existing?.quantity || 0) + quantity;
        if (stock <= 0) return res.status(409).json({ message: "Out of stock" });
        if (newQty > stock || newQty > MAX_QTY) {
            const max = Math.min(stock, MAX_QTY);
            return res.status(409).json({ message: existing ? `Only ${max} available (you have ${existing.quantity} in your cart)` : `Only ${max} left` });
        }

        if (existing) existing.quantity = newQty;
        else cart.items.push({ productId, quantity });
        await cart.save();

        res.status(200).json({ message: "Product added to cart", ...(await formatCart(cart)) });
    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get('/all', isLogged, async (req, res) => {
    try {
        const user = await userModel.findById(req.user.userId);
        // No cart yet is an empty cart, not an error (SHARED_DECISIONS D8)
        const cart = user?.cart ? await cartModel.findById(user.cart) : null;
        res.status(200).json(await formatCart(cart));
    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.post('/remove', isLogged, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: "Invalid product id" });

        const cart = await getOrCreateCart(req.user.userId);
        if (!cart) return res.status(404).json({ message: "User not found" });

        const initialLength = cart.items.length;
        cart.items = cart.items.filter(item => item.productId.toString() !== productId);
        if (cart.items.length === initialLength) {
            return res.status(404).json({ message: "Product not found in cart", ...(await formatCart(cart)) });
        }
        await cart.save();

        res.status(200).json({ message: "Product removed from cart", ...(await formatCart(cart)) });
    } catch (error) {
        console.error("Error removing product from cart:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.post('/update-quantity', isLogged, async (req, res) => {
    try {
        const { productId } = req.body;
        const quantity = parseQty(req.body.quantity);
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: "Invalid product id" });
        if (!quantity) return res.status(400).json({ message: `Quantity must be a whole number from 1 to ${MAX_QTY}` });

        const cart = await getOrCreateCart(req.user.userId);
        if (!cart) return res.status(404).json({ message: "User not found" });

        const item = cart.items.find(item => item.productId.toString() === productId);
        if (!item) return res.status(404).json({ message: "Product not found in cart", ...(await formatCart(cart)) });

        // Lowering the quantity is always allowed (it is how a short-stock line is fixed); raising is capped at the stock
        const stock = await stockOfProduct(productId);
        if (quantity > item.quantity && quantity > stock) {
            return res.status(409).json({ message: stock > 0 ? `Only ${stock} left` : "Out of stock", ...(await formatCart(cart)) });
        }

        item.quantity = quantity;
        await cart.save();
        res.status(200).json({ message: "Quantity updated", ...(await formatCart(cart)) });
    } catch (error) {
        console.error("Error updating quantity:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
