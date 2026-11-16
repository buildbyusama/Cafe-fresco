const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        required: true
    },

    review: {
        type: String,
        trim: true,
        minlength: 3,
        maxlength: 1000,
    },

    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },

}, { timestamps: true })

// One review per customer per product (rule C6)
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('review', reviewSchema);
