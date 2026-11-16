// Money formula shared by cart, orders and discounts (SHARED_DECISIONS D1)
const Product = require('../models/product');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// unitPrice = round2(price × (1 − discount/100))
const unitPrice = (product) => round2(product.price * (1 - (product.discount || 0) / 100));

class PriceError extends Error {
    constructor(message, productId, status = 409) {
        super(message);
        this.productId = productId;
        this.status = status;
    }
}

// [{productId, quantity}] → { lines:[{productId,title,unitPrice,quantity,lineTotal}], subtotal } from DB prices
async function computeLines(items) {
    const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } }).select('title price discount isActive');
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const lines = items.map(({ productId, quantity }) => {
        const product = byId.get(String(productId));
        if (!product) throw new PriceError('A product in your cart no longer exists', productId, 409);
        if (product.isActive === false) throw new PriceError(`${product.title} is no longer available`, productId, 409);
        const price = unitPrice(product);
        return { productId, title: product.title, unitPrice: price, quantity, lineTotal: round2(price * quantity) };
    });
    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    return { lines, subtotal };
}

module.exports = { round2, unitPrice, computeLines, PriceError };
