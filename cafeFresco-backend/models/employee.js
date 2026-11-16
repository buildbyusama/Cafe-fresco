const mongoose = require('mongoose');

// Pakistani CNIC: 12345-1234567-1 (kept as text so leading zeros and dashes survive)
const CNIC_REGEX = /^\d{5}-\d{7}-\d$/;

const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, unique: true, trim: true, match: [CNIC_REGEX, 'CNIC must look like 12345-1234567-1'] },
    email: { type: String, unique: true, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    position: { type: String, trim: true },
    salary: { type: Number, min: 0 },
    hireDate: { type: Date, default: Date.now },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'department'
    },
    address: {
        type: String,
        trim: true,
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

employeeSchema.statics.CNIC_REGEX = CNIC_REGEX;

module.exports = mongoose.model('employee', employeeSchema);
