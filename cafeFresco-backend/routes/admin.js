const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const adminModal = require('../models/admin');
const { createLimiter } = require('../middleware/loginLimiter');
const { adminCookieOptions } = require('../utils/cookies');
const { validatePassword, normalizeEmail, isObjectId } = require('../utils/validation');
const validator = require('validator');
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');
require('dotenv').config();
const transporter = require('../config/mailer');
const SECRET_KEY = process.env.SECRET_KEY;
const crypto = require('crypto');
const notifyModel = require('../models/notification')

// Admin accounts are created only via /create-permission or `npm run seed:admin`

// Separate counters from the customer limiters (SHARED_DECISIONS D10)
const adminLoginLimiter = createLimiter({ max: 5, skipSuccessfulRequests: true });
const forgotLimiter = createLimiter({ max: 5 });
const resetLimiter = createLimiter({ max: 5 });

// âœ… Login Route
router.post('/login', adminLoginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Same message for unknown email and wrong password, so emails can't be probed
        const checkAdmin = await adminModal.findOne({ email: normalizeEmail(email) });
        const isMatch = checkAdmin && await bcrypt.compare(String(password), checkAdmin.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // âœ… Generate JWT Token
        const token = jwt.sign(
            { userId: checkAdmin._id, name: checkAdmin.name, role: checkAdmin.role },
            SECRET_KEY,
            { expiresIn: '15d' }
        );

        res.cookie('adminToken', token, adminCookieOptions());

        res.status(200).json({ message: "Login successful", admin: { name: checkAdmin.name, role: checkAdmin.role } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});


const ROLES = ['admin', 'editor', 'manager'];
const SAFE_ADMIN_FIELDS = 'name email role isRoot';
const isSelf = (req, admin) => String(admin._id) === String(req.admin.userId);
// Never leave the system without a full admin
const wouldRemoveLastAdmin = async (target) => target.role === 'admin' && (await adminModal.countDocuments({ role: 'admin' })) <= 1;

router.post('/create-permission', isAdmin, authorizeRoles("admin"), async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = normalizeEmail(req.body.email);
        const { password, role } = req.body;
        const fields = {};
        if (name.length < 2 || name.length > 60) fields.name = 'Name must be 2–60 characters';
        if (!validator.isEmail(email)) fields.email = 'Enter a valid email';
        const passwordError = validatePassword(password);
        if (passwordError) fields.password = passwordError;
        if (!ROLES.includes(role)) fields.role = 'Choose admin, manager or editor';
        if (Object.keys(fields).length) return res.status(400).json({ message: Object.values(fields)[0], fields });

        if (await adminModal.exists({ email })) {
            return res.status(409).json({ message: "Admin with this email already exists", fields: { email: 'Already exists' } });
        }

        const newAdmin = await adminModal.create({ name, email, password: await bcrypt.hash(password, 10), role });
        await notifyModel.create({ name: req.admin.name, message: `${req.admin.name} granted ${role} to ${email}`, type: 'permission' });

        res.status(201).json({ message: `New ${role} added successfully!`, admin: { _id: newAdmin._id, name, email, role, isRoot: false } });
    } catch (error) {
        console.error('Error adding admin:', error);
        res.status(500).json({ message: "Error adding admin" });
    }
});


router.post('/update-permission', isAdmin, authorizeRoles('admin'), async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { role } = req.body;
        if (!email || !ROLES.includes(role)) {
            return res.status(400).json({ message: 'Email and a valid role are required.' });
        }

        const adminUser = await adminModal.findOne({ email });
        if (!adminUser) {
            return res.status(404).json({ message: 'Admin with this email does not exist.' });
        }
        if (adminUser.isRoot) return res.status(403).json({ message: "The root admin's role can't be changed." });
        if (isSelf(req, adminUser)) return res.status(403).json({ message: "You can't change your own role." });
        if (adminUser.role === role) {
            return res.status(200).json({ message: `Role is already set to '${role}'.`, updatedRole: role });
        }
        if (role !== 'admin' && await wouldRemoveLastAdmin(adminUser)) {
            return res.status(409).json({ message: 'This is the last admin. Promote someone else first.' });
        }

        adminUser.role = role;
        await adminUser.save();
        await notifyModel.create({ name: req.admin.name, message: `${req.admin.name} updated ${email}'s permission to ${role}.`, type: 'permission' });

        res.status(200).json({ message: 'Permission updated successfully.', updatedRole: adminUser.role });
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.delete("/delete-permission", isAdmin, authorizeRoles('admin'), async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const admin = await adminModal.findOne({ email });
        if (!admin) {
            return res.status(404).json({ message: 'Admin with this email not found.' });
        }
        if (admin.isRoot) return res.status(403).json({ message: 'Cannot delete a root admin.' });
        if (isSelf(req, admin)) return res.status(403).json({ message: "You can't delete your own account." });
        if (await wouldRemoveLastAdmin(admin)) return res.status(409).json({ message: 'This is the last admin and cannot be deleted.' });

        await adminModal.deleteOne({ _id: admin._id });
        await notifyModel.create({ name: req.admin.name, message: `${req.admin.name} removed permission from ${email}.`, type: 'permission' });

        res.status(200).json({ message: 'Admin permission successfully deleted.' });
    } catch (error) {
        console.error('Error deleting permission:', error);
        res.status(500).json({ message: 'Server error while deleting permission.' });
    }
});


router.get("/all", isAdmin, authorizeRoles("admin"), async (req, res) => {
    try {
        const admins = await adminModal.find().select(SAFE_ADMIN_FIELDS).sort({ isRoot: -1, name: 1 });
        res.status(200).json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: "Error fetching admins" });
    }
});

// /delete/:id removed: unused by both frontends and it allowed self-deletion (req.admin.id was always undefined)

const RESET_SENT_MESSAGE = "If an account exists for this email, a reset link has been sent.";

router.post("/forgot-password", forgotLimiter, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!email) return res.status(400).json({ message: "Email is required" });

        // Same response whether or not the admin exists (no email enumeration)
        const admin = await adminModal.findOne({ email });
        if (!admin) return res.json({ message: RESET_SENT_MESSAGE });

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString("hex");
        admin.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        admin.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
        await admin.save();

        // Send email
        const resetUrl = `${process.env.EMAIL_RESET_URL}/admin/reset-password/${resetToken}`;
        const mailOptions = {
            to: admin.email,
            from: process.env.EMAIL,
            subject: "Password Reset Request",
            html: `<h3>Password Reset Request</h3>
                   <p>Click the link below to reset your password:</p>
                   <a href="${resetUrl}">${resetUrl}</a>
                   <p>This link will expire in 10 minutes.</p>`,
        }; 

        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            // Logged server-side only; response stays identical so emails can't be probed
            console.error("Reset email failed:", mailErr.message);
        }
        res.json({ message: RESET_SENT_MESSAGE });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }
});


router.post("/reset-password/:token", resetLimiter, async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ message: passwordError, fields: { newPassword: passwordError } });
        }

        // Hash token
        const hashedToken = crypto.createHash("sha256").update(String(token)).digest("hex");

        // Find user with the token
        const admin = await adminModal.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!admin) return res.status(400).json({ message: "Invalid or expired token" });

        // Update password
        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(newPassword, salt);
        admin.passwordChangedAt = new Date();
        admin.resetPasswordToken = undefined;
        admin.resetPasswordExpires = undefined;
        await admin.save();

        // Every existing session ends with the old password
        res.clearCookie('adminToken', adminCookieOptions({ clear: true }));
        res.json({ message: "Password reset successful!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    } 
});


// Current session, read from the DB so role changes apply without re-login
router.get('/me', isAdmin, async (req, res) => {
    try {
        const admin = await adminModal.findById(req.admin.userId).select('name email role isRoot');
        if (!admin) {
            res.clearCookie('adminToken', adminCookieOptions({ clear: true }));
            return res.status(401).json({ message: "Session expired, please log in again" });
        }
        res.status(200).json({ name: admin.name, email: admin.email, role: admin.role, isRoot: admin.isRoot });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

const logout = (req, res) => {
    res.clearCookie('adminToken', adminCookieOptions({ clear: true }));
    return res.status(200).json({ message: 'Logged out successfully' });
};

router.post('/logout', logout);

// Latest 20 (not only today) with an unread flag for the current admin
router.get('/notify', isAdmin, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
        const me = String(req.admin.userId);
        // Latest 20 plus every unread one (up to 50), so the list always contains what the unread count counts
        const [latest, unread, unreadCount] = await Promise.all([
            notifyModel.find().sort({ time: -1 }).limit(20).lean(),
            notifyModel.find({ seenBy: { $ne: req.admin.userId } }).sort({ time: -1 }).limit(50).lean(),
            notifyModel.countDocuments({ seenBy: { $ne: req.admin.userId } }),
        ]);
        const byId = new Map([...latest, ...unread].map((n) => [String(n._id), n]));
        const merged = [...byId.values()].sort((a, b) => new Date(b.time) - new Date(a.time));
        const notifications = merged.map(({ seenBy = [], seen, ...n }) => ({ ...n, unread: !seenBy.some((id) => String(id) === me) }));
        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error('Notifications fetch failed:', err);
        res.status(500).json({ message: 'Could not load notifications' });
    }
});

router.post('/mark-seen', isAdmin, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
        const result = await notifyModel.updateMany({ seenBy: { $ne: req.admin.userId } }, { $addToSet: { seenBy: req.admin.userId } });
        res.status(200).json({ message: result.modifiedCount ? 'All notifications marked as read' : 'No unread notifications', updatedCount: result.modifiedCount });
    } catch (err) {
        console.error('Mark seen failed:', err);
        res.status(500).json({ message: 'Could not update notifications' });
    }
});

// Mark one notification read for the current admin (opening it from the dropdown)
router.post('/mark-seen/:id', isAdmin, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid notification id' });
        const result = await notifyModel.updateOne({ _id: req.params.id }, { $addToSet: { seenBy: req.admin.userId } });
        if (!result.matchedCount) return res.status(404).json({ message: 'Notification not found' });
        const unreadCount = await notifyModel.countDocuments({ seenBy: { $ne: req.admin.userId } });
        res.status(200).json({ message: 'Marked as read', unreadCount });
    } catch (err) {
        console.error('Mark one seen failed:', err);
        res.status(500).json({ message: 'Could not update notification' });
    }
});

module.exports = router;
