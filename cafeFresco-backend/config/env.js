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

    if (env.OPENAI_API_KEY && !/^sk-/.test(env.OPENAI_API_KEY.trim())) errors.push('OPENAI_API_KEY must start with sk-');
    if (!env.OPENAI_API_KEY && env.AI_MOCK !== 'true') warnings.push('OPENAI_API_KEY not set: the chat assistant uses rule-based answers only');
    if (env.COOKIE_SECRET && env.COOKIE_SECRET.length < 32) errors.push('COOKIE_SECRET must be at least 32 characters');
    if (env.NODE_ENV === 'production' && env.AI_MOCK === 'true') errors.push('AI_MOCK must not be true in production');
    if (env.NODE_ENV === 'production' && env.LOAD_TEST === 'true') errors.push('LOAD_TEST must not be true in production');
    if (env.VERCEL && Number(env.RAG_MAX_FILE_MB) > 4) warnings.push('RAG_MAX_FILE_MB is above 4: Vercel rejects request bodies over 4.5 MB, so bigger document uploads will fail');
    if (env.INGEST_MODE && !['sync', 'background'].includes(env.INGEST_MODE)) errors.push("INGEST_MODE must be 'sync' or 'background'");
    if (env.VERCEL && env.INGEST_MODE === 'background') errors.push('INGEST_MODE=background does not work on Vercel (work after the response is frozen)');

    warnings.forEach((w) => console.warn(`⚠️  ${w}`));
    if (errors.length) {
        console.error('❌ Invalid configuration:\n  - ' + errors.join('\n  - '));
        process.exit(1);
    }
}

const corsOrigins = () => String(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

// AI settings with industry-standard defaults (A12: model names only here)
const ai = () => ({
    apiKey: (process.env.OPENAI_API_KEY || '').trim(),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embedModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
    moderationModel: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
    mock: process.env.AI_MOCK === 'true',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
    dailyBudget: Number(process.env.AI_DAILY_TOKEN_BUDGET || 2000000),
    priceIn: Number(process.env.OPENAI_PRICE_IN || 0.15),
    priceOut: Number(process.env.OPENAI_PRICE_OUT || 0.6),
    chatEnabled: process.env.CHAT_ENABLED !== 'false',
    retentionDays: Number(process.env.CHAT_RETENTION_DAYS || 30),
});

// Falls back to a key derived from SECRET_KEY so local setups work without a new variable
const cookieSecret = () => process.env.COOKIE_SECRET || require('crypto').createHash('sha256').update('cf_anon:' + (process.env.SECRET_KEY || '')).digest('hex');

// Document knowledge (RAG) limits — docs/RAG_PLAN.md
const rag = () => ({
    maxFileMb: Number(process.env.RAG_MAX_FILE_MB || (process.env.VERCEL ? 4 : 10)),
    maxDocs: Number(process.env.RAG_MAX_DOCS || 50),
    maxChars: 400000,
    maxPassagesTotal: Number(process.env.RAG_MAX_PASSAGES || 20000),
    chunkChars: 1200,
    overlapChars: 200,
    maxPassages: 5,
    perDoc: 2,
    contextChars: 3500,
    // similarity cut-off; calibrated for the real model in step R2.2 (mock vectors use their own scale)
    minScore: Number(process.env.RAG_MIN_SCORE || (process.env.AI_MOCK === 'true' ? 0.3 : 0.32)),
    dims: 512,
    ingestMode: process.env.INGEST_MODE || 'sync',
    budgetShare: 0.5,
});

module.exports = { validateEnv, corsOrigins, ai, cookieSecret, rag };
