// Move images stored in /public/images to Cloudinary and update the documents that point at them.
// Needs CLOUDINARY_URL. Dry run by default: node scripts/migrateImagesToCloud.js   apply: --apply
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const storage = require('../services/storage');

const MODELS = [['product', 'product'], ['category', 'category'], ['user', 'user']];

(async () => {
    const apply = process.argv.includes('--apply');
    if (apply && storage.driver() !== 'cloudinary') {
        console.error('Set CLOUDINARY_URL first (the storage driver is local).');
        process.exit(1);
    }
    await mongoose.connect(process.env.DB_URI);
    let moved = 0, missing = 0;
    for (const [name, folder] of MODELS) {
        const Model = require(`../models/${name}`);
        const docs = await Model.find({ image: /^\/images\// }).select('image').lean();
        for (const d of docs) {
            const file = path.join(__dirname, '..', 'public', d.image.replace(/^\/+/, ''));
            if (!fs.existsSync(file)) { missing++; console.log(`MISSING ${name} ${d._id}: ${d.image}`); continue; }
            if (!apply) { console.log(`WOULD MOVE ${name} ${d._id}: ${d.image}`); moved++; continue; }
            const url = await storage.save(fs.readFileSync(file), { folder, ext: path.extname(file).slice(1) || 'jpg' });
            await Model.updateOne({ _id: d._id, image: d.image }, { $set: { image: url } });
            console.log(`MOVED ${name} ${d._id} → ${url}`);
            moved++;
        }
    }
    console.log(`\n${moved} image(s) ${apply ? 'moved' : 'would be moved (dry run; add --apply)'}, ${missing} missing on disk.`);
    await mongoose.disconnect();
})();
