const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const adminModel = require("../models/admin");

// Valid token AND the admin still exists: a deleted admin's 15-day token stops working immediately.
// The role is read from the DB, so promotions/demotions apply without re-login.
const isAdmin = async (req, res, next) => {
    try {
        const cookies = cookie.parse(req.headers.cookie || "");
        const token = cookies.adminToken;

        if (!token) {
            return res.status(401).json({ message: "Access Denied: No Token Provided" });
        }

        let decodedAdmin;
        try {
            decodedAdmin = jwt.verify(token, process.env.SECRET_KEY);
        } catch {
            return res.status(401).json({ message: "Invalid or Expired Token" });
        }
        if (!decodedAdmin?.userId) {
            return res.status(401).json({ message: "Invalid Token" });
        }

        const admin = await adminModel.findById(decodedAdmin.userId).select('name role isRoot passwordChangedAt').lean();
        if (!admin || (admin.passwordChangedAt && decodedAdmin.iat < Math.floor(admin.passwordChangedAt.getTime() / 1000))) {
            return res.status(401).json({ message: "Session expired, please log in again" });
        }

        req.admin = { ...decodedAdmin, name: admin.name, role: admin.role, isRoot: admin.isRoot };
        next();
    } catch (err) {
        console.error("Admin auth error:", err);
        return res.status(500).json({ message: "Server Error" });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.admin?.role) {
        return res.status(401).json({ message: "Unauthorized: No Admin Found" });
    }
    if (!roles.includes(req.admin.role)) {
        return res.status(403).json({ message: "Forbidden: Access Denied" });
    }
    next();
};

module.exports = { isAdmin, authorizeRoles };
