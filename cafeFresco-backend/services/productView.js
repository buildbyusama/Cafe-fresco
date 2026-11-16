// Public product payload: stock by productId (works with or without the inventory ref), inStock flag,
// no internal review id arrays or search vectors. Shared by /product, /reco and the assistant.
const Inventory = require('../models/inventory');

async function withStock(products) {
    const list = products.map((p) => (typeof p.toJSON === 'function' ? p.toJSON() : { ...p }));
    const rows = await Inventory.find({ productId: { $in: list.map((p) => p._id) } }).select('productId quantityInStock lastUpdated').lean();
    const byId = new Map(rows.map((r) => [String(r.productId), r]));
    return list.map((p) => {
        const inv = byId.get(String(p._id));
        const quantityInStock = inv?.quantityInStock ?? 0;
        const { reviews, embedding, embeddingHash, ...rest } = p;
        return { ...rest, inventory: { _id: inv?._id, quantityInStock, lastUpdated: inv?.lastUpdated }, inStock: quantityInStock > 0 };
    });
}

module.exports = { withStock };
