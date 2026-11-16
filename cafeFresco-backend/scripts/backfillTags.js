// Suggest tags for products that have none, from words in the title, description and category.
// Never sets allergens or dietary facts (those must come from the kitchen).
// Dry run by default: node scripts/backfillTags.js        apply: node scripts/backfillTags.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/product');
require('../models/category');

// tag → words that suggest it (whole words, case-insensitive)
const RULES = {
    grilled: ['grill', 'grilled', 'bbq', 'barbecue', 'tikka', 'kebab', 'seekh', 'steak'],
    cheesy: ['cheese', 'cheesy', 'mozzarella', 'cheddar', 'parmesan'],
    chicken: ['chicken'],
    beef: ['beef', 'steak'],
    seafood: ['fish', 'prawn', 'prawns', 'shrimp', 'salmon', 'tuna', 'seafood', 'crab', 'calamari'],
    sweet: ['cake', 'brownie', 'chocolate', 'dessert', 'ice cream', 'pancake', 'pancakes', 'waffle', 'honey', 'caramel', 'pudding'],
    coffee: ['coffee', 'latte', 'cappuccino', 'espresso', 'mocha', 'americano'],
    'cold drink': ['smoothie', 'shake', 'milkshake', 'juice', 'iced', 'lemonade', 'mojito', 'cold'],
    breakfast: ['breakfast', 'omelette', 'egg', 'eggs', 'toast', 'pancake', 'pancakes', 'paratha', 'bagel'],
    salad: ['salad'],
    pasta: ['pasta', 'spaghetti', 'penne', 'fettuccine', 'lasagna', 'mac'],
    pizza: ['pizza'],
    burger: ['burger'],
    wrap: ['wrap', 'roll', 'shawarma'],
    healthy: ['healthy', 'bowl', 'quinoa', 'avocado', 'salad', 'fresh'],
};

const hasWord = (text, w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

(async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.DB_URI);
    const products = await Product.find({ $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }] }).populate('category', 'title');
    let changed = 0;
    for (const p of products) {
        const text = `${p.title} ${p.description} ${p.category?.title || ''}`;
        const tags = Object.entries(RULES).filter(([, words]) => words.some((w) => hasWord(text, w))).map(([tag]) => tag).slice(0, 6);
        if (!tags.length) continue;
        changed++;
        console.log(`${apply ? 'SET ' : 'WOULD SET'} ${p.title}: ${tags.join(', ')}`);
        if (apply) await Product.updateOne({ _id: p._id, $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }] }, { $set: { tags } });
    }
    console.log(`\n${changed} of ${products.length} untagged products ${apply ? 'tagged' : 'would be tagged (dry run; add --apply)'}`);
    await mongoose.disconnect();
})();
