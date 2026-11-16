const mongoose = require('mongoose');

const adminSchema = mongoose.Schema({
    name: String,
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["admin", "editor", "manager"],
        default: "admin"
    },
    isRoot: {
        type: Boolean,
        default: false
    },
    // tokens issued before this moment are rejected (reset signs out every device)
    passwordChangedAt: { type: Date },
    resetPasswordToken: {
        type: String,
    },
    resetPasswordExpires: {
        type: Date,
    },
})

module.exports = mongoose.model('admin', adminSchema)