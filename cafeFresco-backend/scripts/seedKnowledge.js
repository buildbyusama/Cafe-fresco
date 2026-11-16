// Starter FAQ entries for the assistant, created as DRAFTS (inactive). They are questions customers
// commonly ask; each answer is a placeholder the owner must replace with the real policy and then publish.
// Nothing here is shown to customers until someone switches it on in the dashboard.
// Usage: node scripts/seedKnowledge.js   (skips questions that already exist)
require('dotenv').config();
const mongoose = require('mongoose');
const Knowledge = require('../models/knowledge');

const DRAFTS = [
    ['Do you have parking?', 'parking'],
    ['Is your food halal?', 'halal'],
    ['Do you do catering or bulk orders for events?', 'catering'],
    ['Can I book a table or reserve for a group?', 'reservation'],
    ['Do you have a kids menu or high chairs?', 'kids'],
    ['Can I change or add to my order after placing it?', 'orders'],
    ['Do you have Wi-Fi for customers?', 'wifi'],
    ['Do you offer gift cards or vouchers?', 'gift cards'],
];

(async () => {
    await mongoose.connect(process.env.DB_URI);
    let added = 0;
    for (const [question, tag] of DRAFTS) {
        if (await Knowledge.exists({ question })) continue;
        await Knowledge.create({ question, answer: 'DRAFT: replace with the real answer before publishing.', tags: [tag], isActive: false });
        added++;
    }
    console.log(`${added} draft FAQ entr${added === 1 ? 'y' : 'ies'} added (inactive until you publish them in the dashboard).`);
    await mongoose.disconnect();
})();
