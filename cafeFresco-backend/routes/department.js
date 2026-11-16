const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const departmentModel = require('../models/department');
const employeeModel = require('../models/employee');
const { authorizeRoles, isAdmin } = require('../middleware/isAdmin');
const { escapeRegex } = require('../utils/validation');

// R1: admin + manager
const managers = [isAdmin, authorizeRoles("admin", "manager")];

function parseDepartment(body) {
    const name = String(body?.name || '').trim();
    if (name.length < 2 || name.length > 60) return { message: "Department name must be 2–60 characters." };
    const data = { name, description: String(body.description || '').trim() };
    if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === 'true';
    return { data };
}

// "Kitchen" and "kitchen" are the same department
const nameTaken = (name, excludeId) =>
    departmentModel.exists({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });

router.post('/add', ...managers, async (req, res) => {
    try {
        const parsed = parseDepartment(req.body);
        if (!parsed.data) return res.status(400).json(parsed);
        if (await nameTaken(parsed.data.name)) return res.status(409).json({ message: "Department already exists." });

        const savedDep = await departmentModel.create(parsed.data);
        return res.status(201).json({ message: "Successfully added department", department: savedDep });
    } catch (error) {
        console.error("Error adding department:", error);
        return res.status(500).json({ message: "Server error. Please try again later." });
    }
});

router.put('/update/:id', ...managers, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid department ID." });
        const parsed = parseDepartment(req.body);
        if (!parsed.data) return res.status(400).json(parsed);
        if (await nameTaken(parsed.data.name, id)) return res.status(409).json({ message: "Another department with this name already exists." });

        const updated = await departmentModel.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ message: "Department not found." });
        }
        return res.status(200).json({ message: "Department updated successfully", department: updated });
    } catch (error) {
        console.error("Error updating department:", error);
        return res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// R6: blocked while employees still belong to it
router.delete('/delete/:id', ...managers, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid department ID." });

        const count = await employeeModel.countDocuments({ department: id });
        if (count > 0) {
            return res.status(409).json({ message: `${count} employee${count === 1 ? ' is' : 's are'} in this department. Move ${count === 1 ? 'them' : 'them'} first.` });
        }

        const deleted = await departmentModel.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ message: "Department not found." });
        }
        return res.status(200).json({ message: "Department deleted successfully." });
    } catch (error) {
        console.error("Error deleting department:", error);
        return res.status(500).json({ message: "Server error. Please try again later." });
    }
});

router.get('/fetch', ...managers, async (req, res) => {
    try {
        const [departments, counts] = await Promise.all([
            departmentModel.find().sort({ createdAt: -1 }).lean(),
            employeeModel.aggregate([{ $group: { _id: '$department', n: { $sum: 1 } } }]),
        ]);
        const byDept = new Map(counts.map((c) => [String(c._id), c.n]));
        return res.status(200).json({ departments: departments.map((d) => ({ ...d, employeeCount: byDept.get(String(d._id)) || 0 })) });
    } catch (error) {
        console.error("Error fetching departments:", error);
        return res.status(500).json({ message: "Server error. Please try again later." });
    }
});

module.exports = router
