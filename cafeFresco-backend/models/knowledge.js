const mongoose = require('mongoose');

// Admin-written FAQ entries the assistant can quote (parking, catering, halal, events…).
// New entries start inactive: nothing is published until a person has checked it.
const knowledgeSchema = new mongoose.Schema(
    {
        question: { type: String, required: true, trim: true, maxlength: 200 },
        answer: { type: String, required: true, trim: true, maxlength: 1500 },
        tags: { type: [String], default: [] },
        isActive: { type: Boolean, default: false },
        embedding: { type: [Number], select: false },
        embeddingHash: { type: String, select: false },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    },
    { timestamps: true }
);

knowledgeSchema.index({ isActive: 1 });

module.exports = mongoose.model('knowledge', knowledgeSchema);
