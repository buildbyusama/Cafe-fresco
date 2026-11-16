const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const validator = require('validator');
const Distributor = require('../models/distributer');
const Supplier = require('../models/supplier');
const { authorizeRoles, isAdmin } = require('../middleware/isAdmin');
const { escapeRegex, PHONE_REGEX } = require('../utils/validation');

// R1: admin + manager
const managers = [isAdmin, authorizeRoles("admin", "manager")];
const CATEGORIES = ['vegetables', 'meat', 'dairy', 'beverages', 'bakery', 'other'];

function parseDistributor(body, { partial }) {
    const data = {};
    const fields = {};
    const has = (k) => body[k] !== undefined;
    if (!partial || has('name')) { data.name = String(body.name || '').trim(); if (data.name.length < 2) fields.name = 'Name is required'; }
    if (!partial || has('contactPerson')) { data.contactPerson = String(body.contactPerson || '').trim(); if (data.contactPerson.length < 2) fields.contactPerson = 'Contact person is required'; }
    if (!partial || has('phone')) { data.phone = String(body.phone || '').trim(); if (!PHONE_REGEX.test(data.phone)) fields.phone = 'Enter a valid phone number'; }
    if (!partial || has('email')) { data.email = String(body.email || '').trim().toLowerCase(); if (!validator.isEmail(data.email)) fields.email = 'Enter a valid email'; }
    if (has('address')) data.address = String(body.address || '').trim();
    if (has('supplyCategories')) {
        data.supplyCategories = (Array.isArray(body.supplyCategories) ? body.supplyCategories : [body.supplyCategories]).filter(Boolean);
        if (data.supplyCategories.some((s) => !CATEGORIES.includes(s))) fields.supplyCategories = 'Unknown supply category';
    }
    if (has('isActive')) data.isActive = body.isActive === true || body.isActive === 'true';
    return Object.keys(fields).length ? { message: Object.values(fields)[0], fields } : { data };
}

const handleError = (res, err, fallback) => {
    if (err?.code === 11000) return res.status(409).json({ message: 'A distributor with this email already exists', fields: { email: 'Already used' } });
    console.error(fallback, err);
    return res.status(500).json({ message: fallback });
};

// Create a distributor
router.post('/create', ...managers, async (req, res) => {
    try {
        const parsed = parseDistributor(req.body, { partial: false });
        if (parsed.fields) return res.status(400).json(parsed);
        res.status(201).json(await Distributor.create(parsed.data));
    } catch (err) {
        handleError(res, err, 'Could not create distributor');
    }
});

// Update a distributor
router.put('/update/:id', ...managers, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid distributor ID' });
        const parsed = parseDistributor(req.body, { partial: true });
        if (parsed.fields) return res.status(400).json(parsed);
        const updated = await Distributor.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: "Distributor not found" });
        res.json(updated);
    } catch (err) {
        handleError(res, err, 'Could not update distributor');
    }
});

// R6: blocked while suppliers still reference it
router.delete('/delete/:id', ...managers, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid distributor ID' });
        const count = await Supplier.countDocuments({ distributor: req.params.id });
        if (count > 0) {
            return res.status(409).json({ message: `${count} supplier${count === 1 ? ' uses' : 's use'} this distributor. Reassign or deactivate instead.` });
        }
        const deleted = await Distributor.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Distributor not found" });
        res.json({ message: "Distributor deleted successfully" });
    } catch (err) {
        handleError(res, err, 'Could not delete distributor');
    }
});

// Fetch with filters (+ supplierCount)
router.get('/', ...managers, async (req, res) => {
    try {
        const { supplyCategory, name, isActive } = req.query;
        const filter = {};
        if (supplyCategory && CATEGORIES.includes(supplyCategory)) filter.supplyCategories = { $in: [supplyCategory] };
        if (name) filter.name = { $regex: escapeRegex(String(name).trim()), $options: 'i' };
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const [distributors, counts] = await Promise.all([
            Distributor.find(filter).sort({ createdAt: -1 }).lean(),
            Supplier.aggregate([{ $group: { _id: '$distributor', n: { $sum: 1 } } }]),
        ]);
        const byId = new Map(counts.map((c) => [String(c._id), c.n]));
        res.json({ distributors: distributors.map((d) => ({ ...d, supplierCount: byId.get(String(d._id)) || 0 })) });
    } catch (err) {
        handleError(res, err, 'Could not load distributors');
    }
});



module.exports = router;
