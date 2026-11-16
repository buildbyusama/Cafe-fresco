const jwt = require('jsonwebtoken');
const cookie = require('cookie');

// Sets req.admin when a valid adminToken is present; never rejects (SHARED_DECISIONS D7)
const optionalAdmin = (req, res, next) => {
    try {
        const token = cookie.parse(req.headers.cookie || '').adminToken;
        if (token) {
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            if (decoded?.userId) req.admin = decoded;
        }
    } catch {
        // invalid or expired token: treat as a shop visitor
    }
    next();
};

module.exports = optionalAdmin;
