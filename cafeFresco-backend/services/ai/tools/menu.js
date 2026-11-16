// Menu tools: search, one dish, categories, deals, recommendations. Read-only, shop-visible dishes only.
const mongoose = require('mongoose');
const Product = require('../../../models/product');
const Category = require('../../../models/category');
const Inventory = require('../../../models/inventory');
const { unitPrice } = require('../../../utils/price');
const { semanticSearch } = require('../embeddings');
const reco = require('../../recommendations');

const SPICE = ['not spicy', 'mild', 'medium', 'hot'];

async function stockOf(ids) {
    const rows = await Inventory.find({ productId: { $in: ids } }).select('productId quantityInStock').lean();
    return new Map(rows.map((r) => [String(r.productId), r.quantityInStock]));
}

// Compact dish facts for the model (A1: the only source of prices/stock it may quote)
function dishFacts(p, stock) {
    const left = stock.get(String(p._id)) ?? 0;
    const d = p.dietary || {};
    return {
        id: String(p._id),
        title: p.title,
        category: p.category?.title || null,
        finalPrice: unitPrice(p),
        originalPrice: p.price,
        discountPercent: p.discount || 0,
        inStock: left > 0,
        ...(left > 0 && left <= 5 ? { stockNote: `only ${left} left` } : {}),
        rating: p.reviewCount ? { average: p.averageRating, reviews: p.reviewCount } : null,
        tags: p.tags || [],
        dietary: { vegetarian: d.vegetarian ?? 'unknown', vegan: d.vegan ?? 'unknown', spice: d.spicyLevel == null ? 'unknown' : SPICE[d.spicyLevel] },
    };
}

// What the chat widget renders (image etc.); the model never sees these
const dishCard = (p, stock) => ({ type: 'dish', id: String(p._id), title: p.title, image: p.image || '', price: unitPrice(p), originalPrice: p.price, inStock: (stock.get(String(p._id)) ?? 0) > 0 });

async function present(products, limit) {
    const list = products.slice(0, limit);
    const stock = await stockOf(list.map((p) => p._id));
    return { data: { items: list.map((p) => dishFacts(p, stock)) }, cards: list.map((p) => dishCard(p, stock)) };
}

async function resolveCategory(name) {
    if (!name) return null;
    if (mongoose.Types.ObjectId.isValid(name)) return name;
    const rx = new RegExp(String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return (await Category.findOne({ title: rx }).select('_id').lean())?._id || 'none';
}

module.exports = [
    {
        name: 'search_menu',
        description: 'Find dishes on the Cafe Fresco menu by meaning, name, category, price range, tags or diet. Use for any question about what we serve, prices, or "something like…".',
        parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                query: { type: 'string', description: 'What the customer wants, in their words' },
                category: { type: 'string', description: 'Category name, e.g. Breakfast' },
                minPrice: { type: 'number', minimum: 0 },
                maxPrice: { type: 'number', minimum: 0 },
                tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                diet: { type: 'string', enum: ['vegetarian', 'vegan'] },
                limit: { type: 'integer', minimum: 1, maximum: 6 },
            },
        },
        async handler(args) {
            const category = await resolveCategory(args.category);
            if (category === 'none') return { data: { items: [], note: `No category called "${args.category}"` } };
            const { products } = await semanticSearch(args.query || '', { limit: args.limit || 4, category, minPrice: args.minPrice, maxPrice: args.maxPrice, tags: args.tags, diet: args.diet, inStockOnly: false });
            // in-stock first, keep the search order otherwise
            const stock = await stockOf(products.map((p) => p._id));
            products.sort((a, b) => ((stock.get(String(b._id)) ?? 0) > 0) - ((stock.get(String(a._id)) ?? 0) > 0));
            return present(products, args.limit || 4);
        },
    },
    {
        name: 'get_dish',
        description: 'Full details of one dish by its id (from search results): description, price, stock, rating, diet, verified allergens.',
        parameters: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } },
        async handler({ id }) {
            if (!mongoose.Types.ObjectId.isValid(id)) return { data: { error: 'not_found', message: 'That dish was not found.' } };
            const p = await Product.findOne({ _id: id, isActive: { $ne: false } }).populate('category', 'title').lean();
            if (!p) return { data: { error: 'not_found', message: 'That dish is not on the menu.' } };
            const stock = await stockOf([p._id]);
            return {
                data: {
                    ...dishFacts(p, stock),
                    description: String(p.description || '').slice(0, 300),
                    // only allergen info staff have checked (A1); otherwise tell the customer to ask
                    allergens: p.allergensVerified ? p.allergens || [] : 'not verified: ask staff',
                },
                cards: [dishCard(p, stock)],
            };
        },
    },
    {
        name: 'list_categories',
        description: 'The menu categories with how many dishes each has and the lowest price.',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
        async handler() {
            const rows = await Product.aggregate([
                { $match: { isActive: { $ne: false } } },
                { $group: { _id: '$category', count: { $sum: 1 }, from: { $min: { $multiply: ['$price', { $subtract: [1, { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] }] } } } },
            ]);
            const cats = await Category.find({ _id: { $in: rows.map((r) => r._id) } }).select('title').lean();
            const byId = new Map(cats.map((c) => [String(c._id), c.title]));
            return { data: { categories: rows.filter((r) => byId.has(String(r._id))).map((r) => ({ title: byId.get(String(r._id)), dishes: r.count, fromPrice: Math.round(r.from * 100) / 100 })).sort((a, b) => b.dishes - a.dishes) } };
        },
    },
    {
        name: 'get_deals',
        description: 'Dishes that are discounted right now and in stock, biggest discount first.',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
        async handler() {
            const stocked = await Inventory.find({ quantityInStock: { $gt: 0 } }).select('productId').lean();
            const products = await Product.find({ isActive: { $ne: false }, discount: { $gt: 0 }, _id: { $in: stocked.map((s) => s.productId) } }).sort({ discount: -1, _id: 1 }).limit(6).populate('category', 'title').lean();
            return present(products, 6);
        },
    },
    {
        name: 'recommend',
        description: 'Recommendations: for_me (this customer\'s taste), trending (popular this week), similar (needs productId), with_cart (goes with their cart).',
        parameters: {
            type: 'object',
            additionalProperties: false,
            required: ['mode'],
            properties: { mode: { type: 'string', enum: ['for_me', 'trending', 'similar', 'with_cart'] }, productId: { type: 'string' } },
        },
        async handler({ mode, productId }, ctx) {
            let ids;
            if (mode === 'trending') ids = await reco.trending();
            else if (mode === 'for_me') ids = (await reco.forUser({ userId: ctx.userId, anonId: ctx.anonId })).ids;
            else if (mode === 'similar') {
                if (!mongoose.Types.ObjectId.isValid(productId)) return { data: { error: 'bad_request', message: 'Which dish should I compare with?' } };
                ids = (await reco.similar(productId)) || [];
            } else {
                const Cart = require('../../../models/cart');
                const cart = ctx.userId ? await Cart.findOne({ userId: ctx.userId }).lean() : null;
                ids = await reco.withCart((cart?.items || []).map((i) => i.productId));
            }
            return present(await reco.hydrate(ids), 4);
        },
    },
];

module.exports.dishFacts = dishFacts;
