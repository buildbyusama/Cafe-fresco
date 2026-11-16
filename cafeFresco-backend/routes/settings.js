const express = require('express');
const router = express.Router();
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const { getSettings, publicView, parseUpdate, saveSettings } = require('../services/settings');
const notifyModel = require('../models/notification');

// Website + assistant: safe fields only
router.get('/public', async (req, res) => {
    try {
        res.set('Cache-Control', 'public, max-age=60');
        res.json(publicView(await getSettings()));
    } catch (err) {
        console.error('Settings read failed:', err);
        res.status(500).json({ message: 'Could not load store info' });
    }
});

// Dashboard: everything (admin only)
router.get('/', isAdmin, authorizeRoles('admin'), async (req, res) => {
    try {
        const { _id, __v, key, ...rest } = await getSettings();
        res.json(rest);
    } catch (err) {
        console.error('Settings read failed:', err);
        res.status(500).json({ message: 'Could not load store info' });
    }
});

router.put('/', isAdmin, authorizeRoles('admin'), async (req, res) => {
    try {
        const parsed = parseUpdate(req.body || {});
        if (parsed.fields) return res.status(400).json({ message: Object.values(parsed.fields)[0], fields: parsed.fields });
        if (!Object.keys(parsed.value).length) return res.status(400).json({ message: 'Nothing to update' });
        const { _id, __v, key, ...saved } = await saveSettings(parsed.value, req.admin.userId);
        notifyModel.create({ name: req.admin.name, message: `${req.admin.name} updated the store info`, type: 'settings', link: '/admin/store-info' }).catch(() => {});
        res.json({ message: 'Store info saved', settings: saved });
    } catch (err) {
        console.error('Settings save failed:', err);
        res.status(500).json({ message: 'Could not save store info' });
    }
});

module.exports = router;
