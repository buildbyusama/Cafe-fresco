// Session cookie options (SHARED_DECISIONS D10): httpOnly, cross-site safe in production
const TOKEN_TTL_MS = 15 * 24 * 60 * 60 * 1000;

const baseOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
    };
};

// Pass { clear: true } for res.clearCookie (no maxAge)
const adminCookieOptions = ({ clear = false } = {}) => (clear ? baseOptions() : { ...baseOptions(), maxAge: TOKEN_TTL_MS });
const userCookieOptions = ({ clear = false } = {}) => (clear ? baseOptions() : { ...baseOptions(), maxAge: TOKEN_TTL_MS });

module.exports = { TOKEN_TTL_MS, adminCookieOptions, userCookieOptions };
