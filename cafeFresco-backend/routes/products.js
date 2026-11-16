const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Category = require('../models/category')
const Inventory = require('../models/inventory')
const upload = require('../middleware/multer')
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin')
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { setStock, adjustStock, StockError } = require('../services/inventoryService');
const optionalAdmin = require('../middleware/optionalAdmin');
const Order = require('../models/order');
const Cart = require('../models/cart');
const Wishlist = require('../models/wishlist');
const Review = require('../models/review');
const { escapeRegex } = require('../utils/validation');
const { scheduleEmbed, semanticSearch, bust: bustSearch } = require('../services/ai/embeddings');
const { createLimiter } = require('../middleware/loginLimiter');

const searchLimiter = createLimiter({ windowMs: 60 * 1000, max: 30, message: 'Too many searches, please slow down.' });



const EDITABLE = ['title', 'description', 'price', 'discount', 'category', 'featured', 'newRelease', 'isActive'];
const toBool = (v) => v === true || v === 'true';
const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'peanut', 'soy', 'fish', 'shellfish', 'sesame'];
// multipart forms send lists/objects as JSON strings; JSON bodies send them as-is
const fromForm = (v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return Symbol.for('bad'); }
};
const triState = (v) => (v === null || v === '' || v === 'unknown' || v === undefined ? null : v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);

// tags / dietary / allergens → adds to data, or to fields on error
function parseFoodFacts(body, data, fields) {
    if (body.tags !== undefined) {
        const tags = fromForm(body.tags);
        if (!Array.isArray(tags)) fields.tags = 'Tags must be a list';
        else {
            const clean = [...new Set(tags.map((t) => String(t).trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
            if (clean.length > 10) fields.tags = 'At most 10 tags';
            else if (clean.some((t) => t.length < 2 || t.length > 24 || !/^[\p{L}\p{N} &'-]+$/u.test(t))) fields.tags = 'Each tag: 2–24 letters, numbers, spaces, & or -';
            else data.tags = clean;
        }
    }
    if (body.dietary !== undefined) {
        const d = fromForm(body.dietary);
        if (!d || typeof d !== 'object' || Array.isArray(d)) fields.dietary = 'Invalid dietary info';
        else {
            const vegetarian = triState(d.vegetarian), vegan = triState(d.vegan);
            const spicy = d.spicyLevel === null || d.spicyLevel === '' || d.spicyLevel === undefined ? null : Number(d.spicyLevel);
            if (vegetarian === undefined || vegan === undefined) fields.dietary = 'Vegetarian/vegan must be yes, no or unknown';
            else if (spicy !== null && !(Number.isInteger(spicy) && spicy >= 0 && spicy <= 3)) fields.dietary = 'Spice level must be 0–3';
            else if (vegan === true && vegetarian === false) fields.dietary = 'A vegan dish is also vegetarian';
            else data.dietary = { vegetarian: vegan === true ? true : vegetarian, vegan, spicyLevel: spicy };
        }
    }
    if (body.allergens !== undefined) {
        const a = fromForm(body.allergens);
        if (!Array.isArray(a) || a.some((x) => !ALLERGENS.includes(String(x)))) fields.allergens = `Allergens must be from: ${ALLERGENS.join(', ')}`;
        else data.allergens = [...new Set(a.map(String))];
    }
    if (body.allergensVerified !== undefined) data.allergensVerified = toBool(body.allergensVerified);
}
// Optional "stock I was looking at" for conflict detection; absent or invalid → no check (older clients)
const parseExpected = (v) => (v === undefined || v === '' || !Number.isInteger(Number(v)) ? undefined : Number(v));
const imageFile = (image) => path.join(__dirname, '..', 'public', String(image || '').replace(/^\/+/, ''));
const removeImage = (image) => {
    if (!image) return;
    const file = imageFile(image);
    if (fs.existsSync(file)) fs.unlink(file, () => {});
};

// Pick allowed fields and validate them → { data } or { error, fields }
async function parseProductInput(body, { partial }) {
    const data = {};
    const fields = {};
    for (const key of EDITABLE) {
        if (body[key] === undefined || (partial && body[key] === '')) continue;
        data[key] = body[key];
    }
    if (data.title !== undefined) {
        data.title = String(data.title).trim();
        if (data.title.length < 2 || data.title.length > 120) fields.title = 'Title must be 2–120 characters';
    }
    if (data.description !== undefined) {
        data.description = String(data.description).trim();
        if (!data.description) fields.description = 'Description is required';
    }
    if (data.price !== undefined) {
        data.price = Number(data.price);
        if (!Number.isFinite(data.price) || data.price < 0) fields.price = 'Price must be 0 or more';
    }
    if (data.discount !== undefined) {
        data.discount = data.discount === '' ? 0 : Number(data.discount);
        if (!Number.isFinite(data.discount) || data.discount < 0 || data.discount > 100) fields.discount = 'Discount must be between 0 and 100';
    }
    if (data.category !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(data.category) || !(await Category.exists({ _id: data.category }))) fields.category = 'Choose an existing category';
    }
    for (const flag of ['featured', 'newRelease', 'isActive']) if (data[flag] !== undefined) data[flag] = toBool(data[flag]);
    parseFoodFacts(body, data, fields);

    if (!partial) {
        for (const req of ['title', 'description', 'price', 'category']) if (data[req] === undefined && !fields[req]) fields[req] = `${req[0].toUpperCase() + req.slice(1)} is required`;
    }

    let stock;
    if (body.stock !== undefined && body.stock !== '') {
        stock = Number(body.stock);
        if (!Number.isInteger(stock) || stock < 0) fields.stock = 'Stock must be a whole number of 0 or more';
    } else if (!partial) {
        fields.stock = 'Stock is required';
    }

    if (Object.keys(fields).length) return { error: Object.values(fields)[0], fields };
    return { data, stock };
}

const duplicateTitle = (title, excludeId) =>
    Product.exists({ title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });

// ✅ Add a new product
router.post('/add', isAdmin, authorizeRoles("editor", "manager", "admin"), upload('product'), async (req, res) => {
    let saved = null;
    try {
        const parsed = await parseProductInput(req.body, { partial: false });
        if (parsed.error) return res.status(400).json({ message: parsed.error, fields: parsed.fields });
        if (await duplicateTitle(parsed.data.title)) {
            return res.status(409).json({ message: 'A product with this title already exists', fields: { title: 'Title already used' } });
        }

        saved = await Product.create({ ...parsed.data, image: req.file ? `/images/product/${req.file.filename}` : '' });
        const inventory = await setStock(saved._id, parsed.stock);
        saved.inventory = inventory._id;
        await saved.save();

        scheduleEmbed(saved._id);
        res.status(201).json({ message: "Product added successfully", product: saved });
    } catch (error) {
        // Never leave a product without inventory
        if (saved) {
            await Product.deleteOne({ _id: saved._id });
            await Inventory.deleteOne({ productId: saved._id });
        }
        console.error("Error adding product:", error);
        res.status(500).json({ message: "Could not add the product" });
    }
});

// ✅ Update a product (only allowed fields; stock goes through the inventory service)
router.put('/update/:id', isAdmin, authorizeRoles("editor", "manager", "admin"), upload('product'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product id' });

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        const parsed = await parseProductInput(req.body, { partial: true });
        if (parsed.error) return res.status(400).json({ message: parsed.error, fields: parsed.fields });
        if (parsed.data.title && await duplicateTitle(parsed.data.title, id)) {
            return res.status(409).json({ message: 'A product with this title already exists', fields: { title: 'Title already used' } });
        }

        const updates = parsed.data;
        if (req.file) {
            updates.image = `/images/product/${req.file.filename}`;
        } else if (toBool(req.body.removeImage)) {
            updates.image = '';
        }

        if (parsed.stock !== undefined) {
            const inventory = await setStock(existingProduct._id, parsed.stock, parseExpected(req.body.expectedStock));
            updates.inventory = inventory._id;
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
            .populate('category', 'title')
            .populate('inventory', 'quantityInStock');

        // Old image goes once the new state is saved
        if (updates.image !== undefined && existingProduct.image && existingProduct.image !== updates.image) removeImage(existingProduct.image);

        scheduleEmbed(id);
        res.status(200).json({ message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        if (error instanceof StockError) return res.status(error.status).json({ message: error.message, fields: { stock: error.message } });
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Could not update the product" });
    }
});
const { withStock } = require('../services/productView');
// Admins may see inactive products only when they ask for them (?includeInactive=true)
const visibility = (req) => (req.admin && req.query.includeInactive === 'true' ? {} : { isActive: { $ne: false } });

// ✅ Delete a product (blocked once it appears in an order: deactivate instead, R6)
router.delete('/delete/:id', isAdmin, authorizeRoles("manager", "admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product id' });

        if (await Order.exists({ 'products.productId': id })) {
            return res.status(409).json({ message: 'This product has orders. Deactivate it instead so order history stays intact.' });
        }

        const deletedProduct = await Product.findByIdAndDelete(id);
        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        await Promise.all([
            Inventory.deleteOne({ productId: id }),
            Review.deleteMany({ product: id }),
            Cart.updateMany({ 'items.productId': id }, { $pull: { items: { productId: id } } }),
            Wishlist.updateMany({ items: id }, { $pull: { items: id } }),
        ]);
        removeImage(deletedProduct.image);
        bustSearch();

        res.status(200).json({ message: "Product deleted" });

    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Could not delete the product" });
    }
});

// ✅ Get all products (shop: active only)
router.get('/all', optionalAdmin, async (req, res) => {
    try {
        const products = await Product.find(visibility(req)).populate('category', 'title');
        res.status(200).json(await withStock(products));
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Random sample of active products matching a flag, with category populated
const sampleActive = async (flag) => {
    const sampled = await Product.aggregate([
        { $match: { [flag]: true, isActive: { $ne: false } } },
        { $sample: { size: 8 } }
    ]);
    return withStock(await Product.populate(sampled, [{ path: 'category', select: 'title' }]));
};

router.get('/new-releases', async (req, res) => {
    try {
        res.status(200).json(await sampleActive('newRelease'));
    } catch (error) {
        console.error("Error fetching new released products:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


router.get('/featured', async (req, res) => {
    try {
        res.status(200).json(await sampleActive('featured'));
    } catch (error) {
        console.error("Error fetching featured products:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


// The menu's best live deal (biggest discount, active, in stock) — landing page badge + offer
router.get('/best-deal', async (req, res) => {
    try {
        const inStock = await Inventory.find({ quantityInStock: { $gt: 0 } }).select('productId').lean();
        const product = await Product.findOne({ isActive: { $ne: false }, discount: { $gt: 0 }, _id: { $in: inStock.map((i) => i.productId) } })
            .sort({ discount: -1, featured: -1, createdAt: 1 })
            .populate('category', 'title');
        if (!product) return res.status(200).json(null);
        res.status(200).json((await withStock([product]))[0]);
    } catch (error) {
        console.error('Error fetching best deal:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get("/fetch", optionalAdmin, async (req, res) => {
    try {
        let { category, name, sort, page = 1, limit = 10, stock } = req.query;

        page = Math.max(1, parseInt(page) || 1);
        limit = Math.min(100, Math.max(1, parseInt(limit) || 10));

        const filter = { ...visibility(req) };
        if (category && mongoose.Types.ObjectId.isValid(category)) {
            filter.category = new mongoose.Types.ObjectId(category);
        }
        if (name) filter.title = { $regex: escapeRegex(String(name).trim()), $options: "i" };

        // Price range on the price the customer pays (same formula as the price sort and the cards)
        const parsePrice = (v) => (v === undefined || v === '' ? null : Number(v));
        const minPrice = parsePrice(req.query.minPrice);
        const maxPrice = parsePrice(req.query.maxPrice);
        if ((minPrice !== null && !(minPrice >= 0)) || (maxPrice !== null && !(maxPrice >= 0))) return res.status(400).json({ message: 'Prices must be numbers of 0 or more' });
        if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) return res.status(400).json({ message: 'Minimum price is above the maximum' });
        if (minPrice !== null || maxPrice !== null) {
            const final = { $round: [{ $multiply: ['$price', { $subtract: [1, { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] }] }, 2] };
            filter.$expr = { $and: [...(minPrice !== null ? [{ $gte: [final, minPrice] }] : []), ...(maxPrice !== null ? [{ $lte: [final, maxPrice] }] : [])] };
        }
        // Tags: every chosen tag must be on the dish
        if (req.query.tags) {
            const tags = String(req.query.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10);
            if (tags.length) filter.tags = { $all: tags };
        }
        if (req.query.diet === 'vegetarian') filter['dietary.vegetarian'] = true;
        else if (req.query.diet === 'vegan') filter['dietary.vegan'] = true;
        else if (req.query.diet) return res.status(400).json({ message: "diet must be 'vegetarian' or 'vegan'" });

        // Stock filter for the inventory page: low (≤ threshold) or out (0)
        if (stock === 'low' || stock === 'out') {
            const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);
            const inv = await Inventory.find(stock === 'out' ? { quantityInStock: { $lte: 0 } } : { quantityInStock: { $gt: 0, $lte: threshold } }).select('productId');
            filter._id = { $in: inv.map((i) => i.productId) };
        }

        let products;
        const skip = (page - 1) * limit;
        if (sort === "low" || sort === "high") {
            // Price sorts use the price the customer pays (after the product discount), so the order
            // matches what the cards show. Computed in the query so paging stays correct.
            const ids = await Product.aggregate([
                { $match: filter },
                { $addFields: { finalPrice: { $multiply: ['$price', { $subtract: [1, { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] }] } } },
                { $sort: { finalPrice: sort === 'low' ? 1 : -1, _id: 1 } },
                { $skip: skip },
                { $limit: limit },
                { $project: { _id: 1 } },
            ]);
            const order = new Map(ids.map((d, i) => [String(d._id), i]));
            products = (await Product.find({ _id: { $in: ids.map((d) => d._id) } }).populate('category').populate('inventory'))
                .sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
        } else {
            let query = Product.find(filter).populate("category").populate("inventory");
            // shop menu default: featured dishes first, then the longest-standing (signature) ones
            if (sort === "recommended") query = query.sort({ featured: -1, createdAt: 1, _id: 1 });
            else query = query.sort({ createdAt: -1, _id: -1 });
            products = await query.skip(skip).limit(limit).exec();
        }
        const totalCount = await Product.countDocuments(filter);

        res.status(200).json({
            success: true,
            total: totalCount,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(totalCount / limit)),
            products: await withStock(products),
        });
    } catch (error) {
        console.error("Fetch Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});


// Distinct tags of shop-visible products with counts (filters, dashboard autocomplete)
// Smart search ("something cheesy under 5"): semantic when AI is available, keyword otherwise
router.get('/search', searchLimiter, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 2 || q.length > 200) return res.status(400).json({ message: 'Search must be 2–200 characters' });
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 8));
        const { products, mode } = await semanticSearch(q, { limit });
        res.json({ mode, products: await withStock(products) });
    } catch (error) {
        console.error('Search failed:', error);
        res.status(500).json({ message: 'Search failed' });
    }
});

router.get('/tags', async (req, res) => {
    try {
        const rows = await Product.aggregate([
            { $match: { isActive: { $ne: false }, 'tags.0': { $exists: true } } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 100 },
        ]);
        res.json({ tags: rows.map((r) => ({ tag: r._id, count: r.count })), allergens: ALLERGENS });
    } catch (error) {
        console.error('Tags fetch failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ✅ Get a single product by ID (invalid id → 400; missing or inactive for the shop → 404)
router.get('/:id', optionalAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product id' });

        const product = await Product.findOne({ _id: id, ...visibility(req) })
            .populate('category', 'title')
            .populate('inventory', 'quantityInStock');

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Older products may lack the inventory reference: look stock up by productId instead
        if (!product.inventory) {
            const inventory = await Inventory.findOne({ productId: product._id }).select('quantityInStock');
            const json = product.toJSON();
            json.inventory = inventory ? { _id: inventory._id, quantityInStock: inventory.quantityInStock } : { quantityInStock: 0 };
            return res.status(200).json(json);
        }

        res.status(200).json(product);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// Stock: mode 'set' (absolute, ≥ 0) or 'adjust' (± delta, atomic, never below 0)
router.post('/inventory/update/:id', isAdmin, authorizeRoles("editor", "manager", "admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product id' });
        if (!(await Product.exists({ _id: id }))) return res.status(404).json({ message: 'Product not found' });

        // Legacy body {quantityInStock} = set
        const mode = req.body.mode || 'set';
        const quantity = Number(req.body.quantity ?? req.body.quantityInStock);
        if (!Number.isInteger(quantity)) return res.status(400).json({ message: 'Quantity must be a whole number' });

        let inventory;
        if (mode === 'set') {
            if (quantity < 0) return res.status(400).json({ message: 'Stock cannot be negative' });
            inventory = await setStock(id, quantity, parseExpected(req.body.expectedStock));
        } else if (mode === 'adjust') {
            if (quantity === 0) return res.status(400).json({ message: 'Enter how many to add or remove' });
            inventory = await adjustStock(id, quantity);
            if (!inventory) {
                const current = await Inventory.findOne({ productId: id });
                return res.status(409).json({ message: `Only ${current?.quantityInStock ?? 0} in stock — cannot remove ${-quantity}` });
            }
        } else {
            return res.status(400).json({ message: "mode must be 'set' or 'adjust'" });
        }
        await Product.updateOne({ _id: id, inventory: { $ne: inventory._id } }, { $set: { inventory: inventory._id } });

        return res.status(200).json({ message: 'Stock updated', inventory });
    } catch (error) {
        if (error instanceof StockError) return res.status(error.status).json({ message: error.message });
        console.error('Inventory update error:', error);
        return res.status(500).json({ message: 'Server error while updating stock' });
    }
});
module.exports = router;
