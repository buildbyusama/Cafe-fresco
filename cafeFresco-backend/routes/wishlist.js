const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const userModel = require('../models/user');
const Wishlist = require('../models/wishlist');
const Product = require('../models/product');
const Inventory = require('../models/inventory');
const isLogged = require('../middleware/isLogged');
const { unitPrice } = require('../utils/price');

// Products for the list: deleted ones are dropped (and the stored list cleaned), stock looked up by productId
const formatWishlist = async (wishlist) => {
    if (!wishlist || wishlist.items.length === 0) return { wishlist: [], count: 0 };
    const products = await Product.find({ _id: { $in: wishlist.items } })
        .select('title price discount image category isActive')
        .populate('category', 'title')
        .lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const kept = wishlist.items.filter((id) => byId.has(String(id)));
    if (kept.length !== wishlist.items.length) {
        await Wishlist.updateOne({ _id: wishlist._id }, { $set: { items: kept } });
    }
    const stock = await Inventory.find({ productId: { $in: kept } }).select('productId quantityInStock').lean();
    const stockOf = new Map(stock.map((s) => [String(s.productId), s.quantityInStock]));
    const items = kept.map((id) => {
        const p = byId.get(String(id));
        const quantityInStock = stockOf.get(String(id)) ?? 0;
        return { ...p, unitPrice: unitPrice(p), inventory: { quantityInStock }, inStock: p.isActive !== false && quantityInStock > 0 };
    });
    return { wishlist: items, count: items.length };
};

const findWishlist = async (userId) => {
    const byUser = await Wishlist.findOne({ userId });
    if (byUser) return byUser;
    const user = await userModel.findById(userId).select('wishlist');
    return user?.wishlist ? Wishlist.findById(user.wishlist) : null;
};

router.post('/add', isLogged, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: "Invalid product id" });
        if (!(await Product.exists({ _id: productId }))) return res.status(404).json({ message: "Product not found" });

        const userId = req.user.userId;
        const user = await userModel.findById(userId).select('wishlist');
        if (!user) return res.status(404).json({ message: "User not found" });

        const before = await findWishlist(userId);
        if (before?.items.some((id) => String(id) === String(productId))) {
            return res.status(400).json({ message: "Product already in wishlist", ...(await formatWishlist(before)) });
        }

        // Atomic: parallel adds store the product once
        const wishlist = await Wishlist.findOneAndUpdate(
            before ? { _id: before._id } : { userId },
            { $addToSet: { items: productId }, $setOnInsert: { userId } },
            { new: true, upsert: true }
        );
        if (String(user.wishlist) !== String(wishlist._id)) await userModel.updateOne({ _id: userId }, { $set: { wishlist: wishlist._id } });

        res.status(200).json({ message: "Product added to wishlist", ...(await formatWishlist(wishlist)) });
    } catch (error) {
        console.error("Error adding product to wishlist:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// No wishlist yet is an empty wishlist, not an error
router.get('/all', isLogged, async (req, res) => {
    try {
        res.status(200).json(await formatWishlist(await findWishlist(req.user.userId)));
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.post('/remove', isLogged, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: "Invalid product id" });

        const current = await findWishlist(req.user.userId);
        if (!current || !current.items.some((id) => String(id) === String(productId))) {
            return res.status(404).json({ message: "Product not in wishlist", ...(await formatWishlist(current)) });
        }
        const wishlist = await Wishlist.findByIdAndUpdate(current._id, { $pull: { items: productId } }, { new: true });

        res.status(200).json({ message: "Product removed from wishlist", ...(await formatWishlist(wishlist)) });
    } catch (error) {
        console.error("Error removing product from wishlist:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


module.exports = router;
