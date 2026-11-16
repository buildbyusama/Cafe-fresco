const { authorizeRoles, isAdmin } = require('../middleware/isAdmin');
const employeeModel = require('../models/employee');
const departmentModel = require('../models/department');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose')
const validator = require('validator');
const { escapeRegex, PHONE_REGEX } = require('../utils/validation');

// R1: admin + manager manage employees; only admin deletes
const managers = [isAdmin, authorizeRoles("admin", "manager")];
const FIELDS = ['name', 'cnic', 'email', 'phone', 'position', 'salary', 'hireDate', 'department', 'address', 'isActive'];

// Accept 13 digits with or without dashes; store as 12345-1234567-1
const formatCnic = (v) => {
    const digits = String(v ?? '').replace(/\D/g, '');
    return digits.length === 13 ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` : String(v ?? '').trim();
};

async function parseEmployee(body, { partial }) {
    const data = {};
    const fields = {};
    for (const k of FIELDS) if (body[k] !== undefined) data[k] = body[k];

    if (!partial || data.name !== undefined) {
        data.name = String(data.name || '').trim();
        if (data.name.length < 2 || data.name.length > 60) fields.name = 'Name must be 2–60 characters';
    }
    if (!partial || data.cnic !== undefined) {
        data.cnic = formatCnic(data.cnic);
        if (!employeeModel.CNIC_REGEX.test(data.cnic)) fields.cnic = 'CNIC must be 13 digits (12345-1234567-1)';
    }
    if (!partial || data.email !== undefined) {
        data.email = String(data.email || '').trim().toLowerCase();
        if (!validator.isEmail(data.email)) fields.email = 'Enter a valid email';
    }
    if (data.phone !== undefined && data.phone !== '') {
        if (!PHONE_REGEX.test(String(data.phone).trim())) fields.phone = 'Enter a valid phone number';
    }
    if (data.salary !== undefined && data.salary !== '') {
        data.salary = Number(data.salary);
        if (!Number.isFinite(data.salary) || data.salary < 0) fields.salary = 'Salary must be 0 or more';
    } else if (data.salary === '') delete data.salary;
    if (data.hireDate !== undefined && data.hireDate !== '' && Number.isNaN(new Date(data.hireDate).getTime())) fields.hireDate = 'Enter a valid date';
    if (data.hireDate === '') delete data.hireDate;
    if (!partial || data.department !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(data.department) || !(await departmentModel.exists({ _id: data.department }))) fields.department = 'Choose an existing department';
    }
    if (data.isActive !== undefined) data.isActive = data.isActive === true || data.isActive === 'true';

    return Object.keys(fields).length ? { message: Object.values(fields)[0], fields } : { data };
}

const duplicateResponse = (res, err) => {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `An employee with this ${field.toUpperCase() === 'CNIC' ? 'CNIC' : field} already exists`, fields: { [field]: 'Already used' } });
};

router.post('/register', ...managers, async (req, res) => {
    try {
        const parsed = await parseEmployee(req.body, { partial: false });
        if (parsed.fields) return res.status(400).json(parsed);
        const savedEmployee = await employeeModel.create(parsed.data);
        res.status(201).json({ message: "Employee registered successfully", employee: savedEmployee });
    } catch (error) {
        if (error?.code === 11000) return duplicateResponse(res, error);
        console.error("Error registering employee:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// Accepts {employeeData:{...}} (current dashboard) or the fields directly
router.post('/update/:id', ...managers, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid employee ID." });
        }
        const parsed = await parseEmployee(req.body.employeeData || req.body, { partial: true });
        if (parsed.fields) return res.status(400).json(parsed);

        const updatedEmployee = await employeeModel.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true }).populate('department', 'name');
        if (!updatedEmployee) {
            return res.status(404).json({ message: "Employee not found." });
        }
        res.status(200).json({ message: "Employee data successfully updated", employee: updatedEmployee });
    } catch (error) {
        if (error?.code === 11000) return duplicateResponse(res, error);
        console.error("Error updating employee:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

router.delete('/delete/:id', isAdmin, authorizeRoles("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid employee ID." });

        const deletedEmployee = await employeeModel.findByIdAndDelete(id);
        if (!deletedEmployee) {
            return res.status(404).json({ message: "Employee does not exist" });
        }

        return res.status(200).json({ message: "Employee deleted successfully" });
    } catch (error) {
        console.error("Error deleting employee:", error);
        return res.status(500).json({ message: "Server error. Please try again later." });
    }
});

router.get('/fetch', ...managers, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const { department } = req.query;
        const search = String(req.query.search ?? req.query.cnic ?? '').trim();

        const query = {};
        if (search) {
            const rx = { $regex: escapeRegex(search), $options: 'i' };
            query.$or = [{ name: rx }, { cnic: rx }, { email: rx }];
        }
        if (department && mongoose.Types.ObjectId.isValid(department)) query.department = department;

        const [total, employees] = await Promise.all([
            employeeModel.countDocuments(query),
            employeeModel.find(query).populate('department', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        ]);

        res.status(200).json({ total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), employees });
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// Edit page loads by URL id (works after refresh / from a shared link)
router.get('/:id', ...managers, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid employee ID.' });
        const employee = await employeeModel.findById(req.params.id).populate('department', 'name');
        if (!employee) return res.status(404).json({ message: 'Employee not found.' });
        res.status(200).json({ employee });
    } catch (error) {
        console.error("Error fetching employee:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

module.exports = router;
