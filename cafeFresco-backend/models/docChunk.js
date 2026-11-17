const mongoose = require('mongoose');

// One searchable passage of a document (≈1200 characters). The embedding is internal: never sent to clients.
const docChunkSchema = new mongoose.Schema({
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'document', required: true },
    version: { type: Number, required: true },
    order: { type: Number, required: true },
    text: { type: String, required: true, maxlength: 1500 },
    heading: { type: String, default: '' },
    chars: { type: Number, default: 0 },
    embedding: { type: [Number], select: false }, // 512 numbers (text-embedding-3-small, dimensions 512)
    embeddingHash: { type: String, select: false },
});

docChunkSchema.index({ documentId: 1, version: 1, order: 1 });

module.exports = mongoose.model('docChunk', docChunkSchema);
