const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const validator = require('validator');
const Supplier = require('../models/supplier');
const Distributor = require('../models/distributer');
const { authorizeRoles, isAdmin } = require('../middleware/isAdmin');
const { PHONE_REGEX } = require('../utils/validation');

// R1: admin + manager
const managers = [isAdmin, authorizeRoles("admin", "manager")];
const SUPPLIES = ['vegetables', 'meat', 'dairy', 'beverages', 'bakery', 'other'];

async function parseSupplier(body, { partial }) {
    const data = {};
    const fields = {};
    const has = (k) => body[k] !== undefined;
    if (!partial || has('name')) { data.name = String(body.name || '').trim(); if (data.name.length < 2) fields.name = 'Name is required'; }
    if (!partial || has('phone')) { data.phone = String(body.phone || '').trim(); if (!PHONE_REGEX.test(data.phone)) fields.phone = 'Enter a valid phone number'; }
    if (!partial || has('email')) { data.email = String(body.email || '').trim().toLowerCase(); if (!validator.isEmail(data.email)) fields.email = 'Enter a valid email'; }
    if (has('address')) data.address = String(body.address || '').trim();
    if (has('supplies')) {
        data.supplies = (Array.isArray(body.supplies) ? body.supplies : [body.supplies]).filter(Boolean);
        if (data.supplies.some((s) => !SUPPLIES.includes(s))) fields.supplies = 'Unknown supply category';
    }
    if (has('distributor')) {
        if (body.distributor === '' || body.distributor === null) data.distributor = null;
        else if (!mongoose.Types.ObjectId.isValid(body.distributor) || !(await Distributor.exists({ _id: body.distributor }))) fields.distributor = 'Choose an existing distributor';
        else data.distributor = body.distributor;
    }
    if (has('isActive')) data.isActive = body.isActive === true || body.isActive === 'true';
    return Object.keys(fields).length ? { message: Object.values(fields)[0], fields } : { data };
}

const handleError = (res, err, fallback) => {
    if (err?.code === 11000) return res.status(409).json({ message: 'A supplier with this email already exists', fields: { email: 'Already used' } });
    console.error(fallback, err);
    return res.status(500).json({ message: fallback });
};

// Create supplier
router.post('/create', ...managers, async (req, res) => {
    try {
        const parsed = await parseSupplier(req.body, { partial: false });
        if (parsed.fields) return res.status(400).json(parsed);
        res.status(201).json(await Supplier.create(parsed.data));
    } catch (err) {
        handleError(res, err, 'Could not create supplier');
    }
});

// Update supplier (only allowed fields; a toggle can send just {isActive})
router.put('/update/:id', ...managers, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid supplier ID' });
        const parsed = await parseSupplier(req.body, { partial: true });
        if (parsed.fields) return res.status(400).json(parsed);
        const updated = await Supplier.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true }).populate('distributor');
        if (!updated) return res.status(404).json({ message: 'Supplier not found' });
        res.json(updated);
    } catch (err) {
        handleError(res, err, 'Could not update supplier');
    }
});

// Delete supplier
router.delete('/delete/:id', ...managers, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid supplier ID' });
        const deleted = await Supplier.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Supplier not found' });
        res.json({ message: 'Supplier deleted successfully' });
    } catch (err) {
        handleError(res, err, 'Could not delete supplier');
    }
});

router.get('/', ...managers, async (req, res) => {
    try {
        const { distributor, supplies, isActive } = req.query;
        const filter = {};
        if (distributor && mongoose.Types.ObjectId.isValid(distributor)) filter.distributor = distributor;
        if (supplies && SUPPLIES.includes(supplies)) filter.supplies = supplies;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const suppliers = await Supplier.find(filter).populate('distributor').sort({ createdAt: -1 });
        res.json({ suppliers });
    } catch (err) {
        handleError(res, err, 'Could not load suppliers');
    }
});

// Edit page loads by URL id
router.get('/:id', ...managers, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid supplier ID' });
        const supplier = await Supplier.findById(req.params.id).populate('distributor');
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
        res.json({ supplier });
    } catch (err) {
        handleError(res, err, 'Could not load supplier');
    }
});


module.exports = router;
