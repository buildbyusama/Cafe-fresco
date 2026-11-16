// One-off: employee.cnic Number → "12345-1234567-1" text (restores leading zeros). Safe to re-run.
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    await mongoose.connect(process.env.DB_URI);
    const col = mongoose.connection.collection('employees');
    let fixed = 0, skipped = 0;
    for (const e of await col.find({}, { projection: { cnic: 1 } }).toArray()) {
        if (typeof e.cnic === 'string' && /^\d{5}-\d{7}-\d$/.test(e.cnic)) continue;
        const digits = String(e.cnic ?? '').replace(/\D/g, '').padStart(13, '0');
        if (digits.length !== 13) { skipped++; console.warn(`Employee ${e._id}: cannot convert CNIC "${e.cnic}"`); continue; }
        await col.updateOne({ _id: e._id }, { $set: { cnic: `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` } });
        fixed++;
    }
    console.log(`CNIC migration: ${fixed} converted, ${skipped} need manual review`);
    await mongoose.disconnect();
})().catch(async (e) => { console.error('Migration failed:', e.message); await mongoose.disconnect(); process.exit(1); });
