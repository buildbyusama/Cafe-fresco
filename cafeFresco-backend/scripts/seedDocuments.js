// Sample shop documents for the assistant (samples/documents/*.md): catering, policies, delivery, food safety, FAQ.
// They hold no prices, hours or contact details: those always come from the database and store settings.
// Usage: node scripts/seedDocuments.js            (adds as drafts; publish them in Dashboard → AI Assistant → Documents)
//        node scripts/seedDocuments.js --publish  (adds and publishes)
// Skips files already uploaded (same content).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Document = require('../models/document');
const { ingest } = require('../services/rag/ingest');

const DIR = path.join(__dirname, '..', 'samples', 'documents');
const publish = process.argv.includes('--publish');

(async () => {
    await mongoose.connect(process.env.DB_URI);
    for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
        const buf = fs.readFileSync(path.join(DIR, file));
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
        if (await Document.exists({ sha256 })) {
            console.log(`skip     ${file} (already uploaded)`);
            continue;
        }
        const title = buf.toString('utf8').match(/^#\s+(.+)$/m)?.[1].replace(/^Cafe Fresco\s+/i, '') || file;
        const doc = await Document.create({ title, fileName: file, mime: 'text/markdown', sizeBytes: buf.length, sha256 });
        const done = await ingest(doc._id, buf, file);
        if (done?.status === 'ready' && publish) await Document.updateOne({ _id: doc._id }, { isPublished: true });
        console.log(`${done?.status === 'ready' ? (publish ? 'published' : 'draft   ') : 'FAILED  '} ${title} · ${done?.chunkCount || 0} passages${done?.error ? ` · ${done.error}` : ''}`);
    }
    await mongoose.disconnect();
})();
