// Shared input rules (SHARED_DECISIONS D10, Main 7.1)
const mongoose = require('mongoose');

const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/;

// At least 8 characters with at least one letter and one digit → error message or null
const validatePassword = (password) => {
    if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one letter and one number';
    return null;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isObjectId = (id) => typeof id === 'string' ? mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id) : mongoose.Types.ObjectId.isValid(id);

// shippingAddress {fullName, phone, city, zip, line1} → { value } or { fields: {name: message} }
const validateShippingAddress = (input) => {
    const a = input && typeof input === 'object' ? input : {};
    const value = {
        fullName: String(a.fullName || '').trim(),
        phone: String(a.phone || '').trim(),
        city: String(a.city || '').trim(),
        zip: String(a.zip || '').trim(),
        line1: String(a.line1 || '').trim(),
    };
    const fields = {};
    if (value.fullName.length < 2 || value.fullName.length > 60) fields.fullName = 'Full name must be 2–60 characters';
    if (!PHONE_REGEX.test(value.phone)) fields.phone = 'Enter a valid phone number';
    if (value.city.length < 2 || value.city.length > 60) fields.city = 'City must be 2–60 characters';
    if (!/^[A-Za-z0-9 -]{3,10}$/.test(value.zip)) fields.zip = 'Enter a valid postal code';
    if (value.line1.length < 5 || value.line1.length > 200) fields.line1 = 'Address must be 5–200 characters';
    return Object.keys(fields).length ? { fields } : { value };
};

module.exports = { PHONE_REGEX, validatePassword, normalizeEmail, escapeRegex, isObjectId, validateShippingAddress };
