const mongoose = require('mongoose');

// Who changed what in the dashboard (SRS 5.8). Kept one year.
const auditLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    adminName: { type: String, default: '' },
    role: { type: String, default: '' },
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    entity: { type: String, required: true }, // product, category, order, discount, permission, settings, knowledge…
    entityId: { type: String, default: null },
    summary: { type: String, default: '' }, // e.g. "POST /product/add"
    changes: { type: Object, default: {} }, // fields sent (secrets removed, long values cut)
    at: { type: Date, default: Date.now },
});

auditLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
auditLogSchema.index({ entity: 1, at: -1 });
auditLogSchema.index({ adminId: 1, at: -1 });

module.exports = mongoose.model('auditLog', auditLogSchema);
