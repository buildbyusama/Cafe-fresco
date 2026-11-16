// Validate configuration once at startup; fail fast with a clear message instead of failing on first use.
require('dotenv').config();

function validateEnv() {
    const errors = [];
    const warnings = [];
    const env = process.env;

    if (!env.DB_URI) errors.push('DB_URI is required (MongoDB connection string)');
    if (!env.SECRET_KEY || env.SECRET_KEY.length < 32) errors.push('SECRET_KEY must be at least 32 characters (use a random value)');
    if (!env.STRIPE_SECRET_KEY || !/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY.trim())) errors.push('STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_… / sk_live_…)');
    if (!env.CORS_ORIGINS) errors.push('CORS_ORIGINS is required (comma-separated list of allowed frontend origins)');
    if (!['development', 'production', 'test'].includes(env.NODE_ENV)) errors.push(`NODE_ENV must be development, production or test (got "${env.NODE_ENV || ''}")`);

    if (!env.EMAIL || !env.EMAIL_PASSWORD) warnings.push('EMAIL / EMAIL_PASSWORD not set: outgoing mail will fail');
    if (!env.EMAIL_RESET_URL || !env.EMAIL_USER_URL) warnings.push('EMAIL_RESET_URL / EMAIL_USER_URL not set: reset links will be broken');
    if (env.NODE_ENV === 'production' && /sk_test_/.test(env.STRIPE_SECRET_KEY || '')) warnings.push('Production is using a Stripe TEST key');

    warnings.forEach((w) => console.warn(`⚠️  ${w}`));
    if (errors.length) {
        console.error('❌ Invalid configuration:\n  - ' + errors.join('\n  - '));
        process.exit(1);
    }
}

const corsOrigins = () => String(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

module.exports = { validateEnv, corsOrigins };
