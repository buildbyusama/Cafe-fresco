// Creates the first root admin from env vars if none exists. Usage: npm run seed:admin
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const adminModal = require('../models/admin');

const run = async () => {
    const name = process.env.ADMIN_SEED_NAME;
    const email = (process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_SEED_PASSWORD || '';

    if (!name || !email || !password) {
        throw new Error('Set ADMIN_SEED_NAME, ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env');
    }
    if (!validator.isEmail(email)) {
        throw new Error('ADMIN_SEED_EMAIL is not a valid email');
    }
    if (password.length < 8) {
        throw new Error('ADMIN_SEED_PASSWORD must be at least 8 characters');
    }

    await mongoose.connect(process.env.DB_URI);

    const existingRoot = await adminModal.findOne({ isRoot: true });
    if (existingRoot) {
        console.log(`Root admin already exists (${existingRoot.email}). Nothing created.`);
        return;
    }
    if (await adminModal.findOne({ email })) {
        throw new Error(`An admin with ${email} already exists but is not root. Promote it manually or use another email.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await adminModal.create({ name, email, password: hashedPassword, role: 'admin', isRoot: true });
    console.log(`Root admin created: ${email}`);
};

run()
    .catch((err) => {
        console.error(`Seed failed: ${err.message}`);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
