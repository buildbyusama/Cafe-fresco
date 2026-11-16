const mongoose = require('mongoose');

const wishlistSchema = mongoose.Schema({
    // One wishlist per user (lets /add upsert atomically)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        unique: true,
    },
    items: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'product',
        }
    ]
});

module.exports = mongoose.model('wishlist', wishlistSchema);
