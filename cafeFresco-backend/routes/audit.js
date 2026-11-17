const express = require('express');
const router = express.Router();
const AuditLog = require('../models/auditLog');
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
const { isObjectId } = require('../utils/validation');
const { TZ, moment } = require('../services/stats');

// Activity log (admin only): who changed what, newest first. Filters: admin, entity, action, from/to (YYYY-MM-DD, shop time)
router.get('/', isAdmin, authorizeRoles('admin'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const filter = {};
        if (req.query.adminId) {
            if (!isObjectId(req.query.adminId)) return res.status(400).json({ message: 'Invalid admin' });
            filter.adminId = req.query.adminId;
        }
        if (req.query.entity) filter.entity = String(req.query.entity).slice(0, 30);
        if (['create', 'update', 'delete'].includes(req.query.action)) filter.action = req.query.action;
        const day = (v, end) => {
            const d = moment.tz(String(v), 'YYYY-MM-DD', true, TZ);
            return d.isValid() ? (end ? d.endOf('day') : d.startOf('day')).toDate() : null;
        };
        if (req.query.from || req.query.to) {
            const from = req.query.from ? day(req.query.from) : null;
            const to = req.query.to ? day(req.query.to, true) : null;
            if ((req.query.from && !from) || (req.query.to && !to)) return res.status(400).json({ message: 'Dates must be YYYY-MM-DD' });
            filter.at = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
        }
        const [total, entries, admins] = await Promise.all([
            AuditLog.countDocuments(filter),
            AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            AuditLog.aggregate([{ $group: { _id: '$adminId', name: { $last: '$adminName' } } }, { $sort: { name: 1 } }]),
        ]);
        res.json({ total, page, totalPages: Math.max(1, Math.ceil(total / limit)), entries, admins: admins.map((a) => ({ id: a._id, name: a.name })) });
    } catch (err) {
        console.error('Audit list failed:', err);
        res.status(500).json({ message: 'Could not load the activity log' });
    }
});

module.exports = router;
