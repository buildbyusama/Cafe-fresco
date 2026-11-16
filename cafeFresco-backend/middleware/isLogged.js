const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const userModel = require('../models/user');

// Valid token AND the account still exists AND the token is newer than the last password change
const isLogged = async (req, res, next) => {
    const cookies = cookie.parse(req.headers.cookie || '');

    if (!cookies.userToken) {
        return res.status(401).json({ message: 'Unauthorized: No token found' });
    }

    let decodedUser;
    try {
        decodedUser = jwt.verify(cookies.userToken, process.env.SECRET_KEY);
    } catch {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    try {
        const user = await userModel.findById(decodedUser.userId).select('passwordChangedAt').lean();
        if (!user || (user.passwordChangedAt && decodedUser.iat < Math.floor(user.passwordChangedAt.getTime() / 1000))) {
            return res.status(401).json({ message: 'Session expired, please log in again' });
        }
        req.user = decodedUser;
        next();
    } catch (err) {
        console.error('User auth error:', err);
        return res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = isLogged;
