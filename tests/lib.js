// Shared test helpers. Tests run from FYP/tests and load backend modules directly.
const path = require('path');
const BACKEND = path.join(__dirname, '..', 'cafeFresco-backend');
const breq = (m) => require(path.join(BACKEND, 'node_modules', m));
breq('dotenv').config({ path: path.join(BACKEND, '.env') });
const mongoose = breq('mongoose');
const bcrypt = breq('bcryptjs');
const model = (n) => require(path.join(BACKEND, 'models', n));
const backend = (p) => require(path.join(BACKEND, p));

const URL = { API: 'http://localhost:3000', SHOP: 'http://localhost:3001', DASH: 'http://localhost:5173' };
const ADMIN = { email: 'admin@cafefresco.local', password: 'ChangeMe@12345' };

let failures = 0;
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  - ${detail}` : ''}`);
    if (!ok) failures++;
};
const connect = () => mongoose.connect(process.env.DB_URI);
const done = async () => {
    console.log(`\n${failures} failures`);
    await mongoose.disconnect().catch(() => {});
    process.exit(failures ? 1 : 0);
};
const tag = () => Date.now().toString(36);

module.exports = { BACKEND, breq, mongoose, bcrypt, model, backend, URL, ADMIN, check, connect, done, tag };
