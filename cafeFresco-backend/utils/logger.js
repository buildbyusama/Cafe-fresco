// Structured JSON logs (pino) with the request id attached automatically, and secrets redacted.
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const pino = require('pino');

const context = new AsyncLocalStorage();

const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'warn' : 'info'),
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    // every line logged inside a request carries its reqId (and user/admin id when known)
    mixin: () => context.getStore() || {},
    redact: {
        paths: ['password', 'newPassword', '*.password', '*.newPassword', 'token', '*.token', 'cookie', 'headers.cookie', 'authorization', 'headers.authorization', 'apiKey', '*.apiKey', 'card', '*.card'],
        censor: '[redacted]',
    },
});

const secretPattern = /(sk-[A-Za-z0-9_-]{8,}|sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,})/g;
const scrub = (s) => String(s).replace(secretPattern, '[redacted]');

// Existing code logs with console.error/warn: send those through the structured logger too
function routeConsole() {
    const toLog = (level) => (...args) => {
        const err = args.find((a) => a instanceof Error);
        const msg = scrub(args.filter((a) => !(a instanceof Error)).map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        logger[level](err ? { err: { message: scrub(err.message), type: err.name, stack: err.stack } } : {}, msg);
    };
    console.error = toLog('error');
    console.warn = toLog('warn');
}

// X-Request-Id in/out (a client-sent id is accepted only if it looks safe) + one access line per request
function requestContext(req, res, next) {
    const incoming = req.get('X-Request-Id');
    const reqId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    req.id = reqId;
    res.setHeader('X-Request-Id', reqId);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        const who = { ...(req.user?.userId ? { userId: String(req.user.userId) } : {}), ...(req.admin?.userId ? { adminId: String(req.admin.userId) } : {}) };
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        context.run({ reqId }, () => logger[level]({ method: req.method, path: req.originalUrl.split('?')[0].replace(/(reset-password)\/[^/]+/, '$1/:token'), status: res.statusCode, ms: Math.round(ms), ...who }, 'request'));
    });
    context.run({ reqId }, next);
}

module.exports = { logger, routeConsole, requestContext, scrub };
