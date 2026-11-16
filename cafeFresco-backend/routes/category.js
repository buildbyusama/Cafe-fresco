const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const categoryModal = require('../models/category')
const Product = require('../models/product')
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin')
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/multer')
const { escapeRegex } = require('../utils/validation');

const removeImage = (image) => {
    if (!image) return;
    fs.unlink(path.join(__dirname, '..', 'public', image.replace(/^\/+/, '')), (err) => {
        if (err && err.code !== 'ENOENT') console.error('Could not delete category image:', err.message);
    });
};

// "Drinks" and "drinks" are the same category
const titleTaken = (title, excludeId) =>
    categoryModal.exists({ title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });

router.post("/add", isAdmin, authorizeRoles("editor", "manager", "admin"), upload('category'), async (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();

    if (title.length < 2 || title.length > 60) {
        return res.status(400).json({ message: "Title must be 2–60 characters", fields: { title: 'Title must be 2–60 characters' } });
    }

    try {
        if (await titleTaken(title)) {
            return res.status(409).json({ message: "Category already exists", fields: { title: 'Already exists' } });
        }

        const newCategory = await categoryModal.create({
            title,
            image: req.file ? `/images/category/${req.file.filename}` : "",
            description,
        });

        res.status(201).json({ message: "Category created successfully", category: newCategory });
    } catch (err) {
        console.error("Error creating category:", err);
        res.status(500).json({ message: "Could not create the category" });
    }
});

router.put('/update/:id', isAdmin, authorizeRoles('editor', 'manager', 'admin'), upload('category'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid category ID' });
        }

        const existingCategory = await categoryModal.findById(id);
        if (!existingCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const updateData = {};
        if (req.body.title !== undefined) {
            const title = String(req.body.title).trim();
            if (title.length < 2 || title.length > 60) return res.status(400).json({ message: 'Title must be 2–60 characters' });
            if (await titleTaken(title, id)) return res.status(409).json({ message: 'Another category already uses this title' });
            updateData.title = title;
        }
        // An empty description is a valid way to clear it
        if (req.body.description !== undefined) updateData.description = String(req.body.description).trim();
        if (req.file) updateData.image = `/images/category/${req.file.filename}`;

        if (!Object.keys(updateData).length) {
            return res.status(400).json({ message: 'Nothing to update' });
        }

        const updatedCategory = await categoryModal.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (req.file && existingCategory.image) removeImage(existingCategory.image);

        return res.status(200).json({ message: 'Category updated successfully', category: updatedCategory });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'Could not update the category' });
    }
});


// R6: a category that still has products can't be deleted
router.delete('/delete/:id', isAdmin, authorizeRoles("manager", "admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        const category = await categoryModal.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        const used = await Product.countDocuments({ category: id });
        if (used > 0) {
            return res.status(409).json({ message: `${used} product${used === 1 ? ' uses' : 's use'} this category. Move ${used === 1 ? 'it' : 'them'} to another category first.` });
        }

        await categoryModal.deleteOne({ _id: id });
        removeImage(category.image);

        res.status(200).json({ message: "Category deleted" });
    } catch (err) {
        console.error("Error in deleting category:", err);
        res.status(500).json({ message: "Could not delete the category" });
    }
});


router.get('/fetch', async (req, res) => {
    try {
        // Per category: how many active dishes, the lowest final price and a dish photo (shop home cards)
        const [categories, stats] = await Promise.all([
            categoryModal.find().sort({ title: 1 }).lean(),
            Product.aggregate([
                { $match: { isActive: { $ne: false }, category: { $ne: null } } },
                // cover: a featured dish first, the longest-standing one (the curated signature dishes)
                { $sort: { featured: -1, createdAt: 1 } },
                {
                    $group: {
                        _id: '$category',
                        productCount: { $sum: 1 },
                        fromPrice: { $min: { $multiply: ['$price', { $subtract: [1, { $divide: [{ $ifNull: ['$discount', 0] }, 100] }] }] } },
                        cover: { $first: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$image', ''] } }, 0] }, '$image', null] } },
                    },
                },
            ]),
        ]);
        const byId = new Map(stats.map((s) => [String(s._id), s]));
        const withStats = categories.map((c) => {
            const s = byId.get(String(c._id));
            return { ...c, productCount: s?.productCount || 0, fromPrice: s ? Math.round(s.fromPrice * 100) / 100 : null, cover: s?.cover || null };
        });
        res.status(200).json({ message: "Categories fetched successfully", categories: withStats });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid category ID' });
        const category = await categoryModal.findById(id);

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json(category);
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
