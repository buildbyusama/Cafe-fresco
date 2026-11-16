const rateLimit = require('express-rate-limit');

// Factory: every use gets its own counter, so customer and admin traffic never share a limit (SHARED_DECISIONS D10)
const createLimiter = ({ max = 5, windowMs = 15 * 60 * 1000, skipSuccessfulRequests = false, message = 'Too many requests, please try again later.' } = {}) =>
    rateLimit({
        windowMs,
        max,
        skipSuccessfulRequests,
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        handler: (req, res) => {
            res.status(429).json({ success: false, message });
        }
    });

// Default export stays a login limiter (5 failed attempts / 15 min) for existing imports
const loginLimiter = createLimiter({ max: 5, skipSuccessfulRequests: true });

module.exports = loginLimiter;
module.exports.createLimiter = createLimiter;
