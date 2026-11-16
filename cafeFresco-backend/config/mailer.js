const nodemailer = require('nodemailer');
require('dotenv').config();

// Single mail transporter; credentials come only from .env (EMAIL, EMAIL_PASSWORD = Gmail app password)
if (!process.env.EMAIL || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️ EMAIL / EMAIL_PASSWORD not set — outgoing mail will fail.');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

module.exports = transporter;
