// Create or refresh search embeddings for every product (only changed ones cost tokens).
// Needs OPENAI_API_KEY. Usage: node scripts/embedProducts.js
require('dotenv').config();
const mongoose = require('mongoose');
require('../models/category');
const { embedProducts } = require('../services/ai/embeddings');

(async () => {
    await mongoose.connect(process.env.DB_URI);
    try {
        const { embedded, skipped } = await embedProducts();
        console.log(`Embedded ${embedded} product(s), ${skipped} already up to date.`);
    } catch (err) {
        console.error(`Embedding failed: ${err.code || ''} ${err.message}`);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();
