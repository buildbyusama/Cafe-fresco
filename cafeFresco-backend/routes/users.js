const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userModal = require('../models/user');
const { escapeRegex, validatePassword, normalizeEmail, PHONE_REGEX } = require('../utils/validation');
const { userCookieOptions } = require('../utils/cookies');
const mongoose = require('mongoose');
const validator = require('validator');
const { createLimiter } = require('../middleware/loginLimiter')
const isLogged = require('../middleware/isLogged')
const transporter = require('../config/mailer');
const crypto = require('crypto');
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const vpnDetect = require('../middleware/vpnDetect')
const { isAdmin, authorizeRoles } = require('../middleware/isAdmin');




// Separate counters from the admin limiters (SHARED_DECISIONS D10)
const userLoginLimiter = createLimiter({ max: 5, skipSuccessfulRequests: true });
const forgotLimiter = createLimiter({ max: 5 });
const resetLimiter = createLimiter({ max: 5 });

const signIn = (res, user) => {
    const token = jwt.sign({ email: user.email, userId: user._id }, SECRET_KEY, { expiresIn: '15d' });
    // httpOnly: JavaScript never sees the token (D10); the session comes from GET /user/me
    res.cookie('userToken', token, userCookieOptions());
};

// Register route
router.post('/register', vpnDetect, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        const fields = {};
        if (name.length < 2 || name.length > 60) fields.name = 'Name must be 2–60 characters';
        if (!validator.isEmail(email)) fields.email = 'Enter a valid email';
        const passwordError = validatePassword(password);
        if (passwordError) fields.password = passwordError;
        const phone = String(req.body.phone || '').trim();
        const address = String(req.body.address || '').trim();
        if (phone && !PHONE_REGEX.test(phone)) fields.phone = 'Enter a valid phone number';
        if (address.length > 200) fields.address = 'Address must be at most 200 characters';
        if (Object.keys(fields).length) return res.status(400).json({ message: Object.values(fields)[0], fields });

        if (await userModal.exists({ email })) {
            return res.status(409).json({ message: 'An account with this email already exists', fields: { email: 'Already registered' } });
        }

        const newUser = await userModal.create({
            name,
            email,
            password: await bcrypt.hash(password, 10),
            address,
            phone,
        });

        signIn(res, newUser);
        return res.status(201).json({ message: 'User registered successfully!', user: { name: newUser.name, email: newUser.email } });
    } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ message: 'An account with this email already exists' });
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Login route: one message for unknown email and wrong password (no enumeration)
router.post('/login', userLoginLimiter, vpnDetect, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const { password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const checkUser = await userModal.findOne({ email });
        const isMatch = checkUser && await bcrypt.compare(String(password), checkUser.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        signIn(res, checkUser);
        res.status(200).json({ message: "Login successful", user: { name: checkUser.name, email: checkUser.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Logout: clears the same cookie with the same options it was set with
router.post('/logout', (req, res) => {
    res.clearCookie('userToken', userCookieOptions({ clear: true }));
    res.status(200).json({ message: "Logout successful" });
});

// Current session from the DB (the frontend never reads the cookie)
router.get('/me', isLogged, async (req, res) => {
    try {
        const user = await userModal.findById(req.user.userId).select('name email phone address');
        if (!user) {
            res.clearCookie('userToken', userCookieOptions({ clear: true }));
            return res.status(401).json({ message: 'Session expired' });
        }
        res.status(200).json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});
//Update-Profile
// Only name, phone and address can change; email is ignored (no uniqueness/verification flow, and it is the login + reset address)
router.put('/update-profile', isLogged, async (req, res) => {
    try {
        const update = {};
        const fields = {};
        if (req.body.name !== undefined) {
            update.name = String(req.body.name).trim();
            if (update.name.length < 2 || update.name.length > 60) fields.name = 'Name must be 2–60 characters';
        }
        if (req.body.phone !== undefined) {
            update.phone = String(req.body.phone).trim();
            if (update.phone && !PHONE_REGEX.test(update.phone)) fields.phone = 'Enter a valid phone number';
        }
        if (req.body.address !== undefined) {
            update.address = String(req.body.address).trim();
            if (update.address.length > 200) fields.address = 'Address must be at most 200 characters';
        }
        if (Object.keys(fields).length) return res.status(400).json({ message: Object.values(fields)[0], fields });

        const user = await userModal.findByIdAndUpdate(
            req.user.userId,
            { $set: update },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = {
            name: user.name,
            email: user.email,
            address: user.address,
            phone: user.phone
        };

        res.status(200).json({
            user: updatedUser,
            message: "User profile updated successfully"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// /upload-image removed (SHARED_DECISIONS D4): unused and unauthenticated




const RESET_SENT_MESSAGE = "If an account exists for this email, a reset link has been sent.";

// Same 200 response whether or not the account exists (D10)
router.post("/forgot-password", forgotLimiter, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!validator.isEmail(email)) return res.status(400).json({ message: "Enter a valid email." });

        const user = await userModal.findOne({ email });
        if (!user) return res.json({ message: RESET_SENT_MESSAGE });

        const resetToken = crypto.randomBytes(20).toString("hex");
        user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        const resetUrl = `${process.env.EMAIL_USER_URL}/user/reset-password/${resetToken}`;
        try {
            await transporter.sendMail({
                to: user.email,
                from: process.env.EMAIL,
                subject: "Password Reset Request",
                html: `<h3>Password Reset Request</h3>
                       <p>Click the link below to reset your password:</p>
                       <a href="${resetUrl}">${resetUrl}</a>
                       <p>This link will expire in 10 minutes.</p>`,
            });
        } catch (mailErr) {
            console.error("Reset email failed:", mailErr.message);
        }
        res.json({ message: RESET_SENT_MESSAGE });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});


// Lets the reset page say "this link has expired" straight away, before anyone types a new password.
// Read-only; the token is a random 160-bit secret, so this only answers yes/no for the one who holds it.
router.get("/reset-password/:token", async (req, res) => {
    try {
        const hashedToken = crypto.createHash("sha256").update(String(req.params.token)).digest("hex");
        const valid = await userModal.exists({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } });
        res.json({ valid: !!valid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});

router.post("/reset-password/:token", resetLimiter, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const passwordError = validatePassword(newPassword);
        if (passwordError) return res.status(400).json({ message: passwordError, fields: { newPassword: passwordError } });

        const hashedToken = crypto.createHash("sha256").update(String(req.params.token)).digest("hex");
        const user = await userModal.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordChangedAt = new Date();
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Any old session ends with the old password
        res.clearCookie('userToken', userCookieOptions({ clear: true }));
        res.json({ message: "Password reset successful! Please log in." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});
const SAFE_USER_FIELDS = 'name email phone address createdAt';

// Paged list response, same shape for /all and /search (SHARED_DECISIONS D8)
async function pagedUsers(filter, req, res) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const [users, totalUsers] = await Promise.all([
        userModal.find(filter).select(SAFE_USER_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        userModal.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: users, totalUsers, currentPage: page, totalPages: Math.max(1, Math.ceil(totalUsers / limit)) });
}

router.get('/all', isAdmin, authorizeRoles("admin", "manager"), async (req, res) => {
    try {
        await pagedUsers({}, req, res);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// Admin/manager only; never returns password or reset tokens; regex input is escaped
router.get('/search', isAdmin, authorizeRoles("admin", "manager"), async (req, res) => {
    const query = String(req.query.query || '').trim();
    if (!query) {
        return res.status(400).json({ message: 'Missing search query' });
    }

    try {
        const rx = { $regex: escapeRegex(query), $options: 'i' };
        const conditions = [{ name: rx }, { email: rx }, { phone: rx }];
        if (mongoose.Types.ObjectId.isValid(query)) conditions.push({ _id: query });
        await pagedUsers({ $or: conditions }, req, res);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Contact form: validated, escaped, sent from the shop address with Reply-To the customer, 5 per hour per IP
const contactLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: Number(process.env.CONTACT_RATE_LIMIT || 5), message: 'Too many messages, please try again later.' });

router.post('/contact', contactLimiter, async (req, res) => {
    const value = {};
    for (const k of ['name', 'email', 'phone', 'subject', 'message']) value[k] = String(req.body[k] ?? '').trim();
    const fields = {};
    if (value.name.length < 2 || value.name.length > 60) fields.name = 'Name must be 2–60 characters';
    if (!validator.isEmail(value.email)) fields.email = 'Enter a valid email';
    if (value.phone && !PHONE_REGEX.test(value.phone)) fields.phone = 'Enter a valid phone number';
    if (value.subject.length < 3 || value.subject.length > 120) fields.subject = 'Subject must be 3–120 characters';
    if (value.message.length < 10 || value.message.length > 2000) fields.message = 'Message must be 10–2000 characters';
    if (Object.keys(fields).length) return res.status(400).json({ message: Object.values(fields)[0], fields });

    const e = (s) => validator.escape(s);
    try {
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: process.env.CONTACT_TO || process.env.CONTACT_EMAIL || process.env.EMAIL,
            replyTo: value.email,
            subject: `New Contact Form: ${value.subject.replace(/[\r\n]+/g, ' ')}`,
            html: `
        <h3>Contact Details</h3>
        <p><strong>Name:</strong> ${e(value.name)}</p>
        <p><strong>Email:</strong> ${e(value.email)}</p>
        <p><strong>Phone:</strong> ${value.phone ? e(value.phone) : '—'}</p>
        <p><strong>Subject:</strong> ${e(value.subject)}</p>
        <p><strong>Message:</strong><br/>${e(value.message).replace(/\n/g, '<br/>')}</p>
      `,
        });
        res.json({ message: 'Message sent successfully!' });
    } catch (err) {
        console.error('Error sending mail:', err.message);
        res.status(502).json({ message: 'We could not send your message right now. Please try again later.' });
    }
});

router.get('/user-info', isLogged, async (req, res) => {
    try {
        const user = await userModal.findById(req.user.userId).select("name email address phone");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});



module.exports = router;
