const mongoose = require('mongoose');

// An uploaded document the assistant can answer from (docs/RAG_PLAN.md). Only the extracted text is kept,
// split into passages (docChunk). Customers only ever see passages of published, ready documents.
const cleanTitle = (v) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

const documentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, minlength: 2, maxlength: 80, set: cleanTitle },
        fileName: { type: String, default: '', set: (v) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 200) },
        mime: { type: String, enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'], required: true },
        sizeBytes: { type: Number, default: 0 },
        sha256: { type: String, required: true, unique: true }, // the same file can't be uploaded twice
        status: { type: String, enum: ['processing', 'ready', 'failed', 'deleting'], default: 'processing' },
        error: { type: String, default: null }, // friendly reason shown to the admin
        isPublished: { type: Boolean, default: false },
        pages: { type: Number, default: 0 },
        chars: { type: Number, default: 0 },
        chunkCount: { type: Number, default: 0 },
        privacyFlags: { type: [{ _id: false, type: { type: String }, count: Number }], default: [] },
        processingStartedAt: { type: Date, default: Date.now },
        version: { type: Number, default: 1 }, // bumped by "Replace file"; passages carry the version they belong to
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    },
    { timestamps: true }
);

documentSchema.index({ isPublished: 1, status: 1 });

module.exports = mongoose.model('document', documentSchema);
module.exports.cleanTitle = cleanTitle;
