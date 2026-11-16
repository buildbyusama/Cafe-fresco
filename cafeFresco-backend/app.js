require('dotenv').config();
const { logger, routeConsole, requestContext } = require('./utils/logger');
routeConsole();
const { validateEnv, corsOrigins } = require('./config/env');
validateEnv();

const cookieParser = require('cookie-parser');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin')
const productRoutes = require('./routes/products')
const categoryRoutes = require('./routes/category')
const reviewRoutes = require('./routes/review');
const cartRoutes = require('./routes/cart');
const wishRoutes = require('./routes/wishlist')
const paymentRoutes = require('./routes/payment')
const orderRoutes = require('./routes/order');
const earningRoutes = require('./routes/dashboard')
const discount = require('./routes/discountCode')
const employee = require('./routes/employee')
const department = require('./routes/department')
const distributer = require('./routes/distributer')
const supplier = require('./routes/supplier');
const settingsRoutes = require('./routes/settings');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === 'development';
const allowedOrigins = corsOrigins();

app.set('trust proxy', 1);

// Request id + access log first, so every later line (and error) is traceable
app.use(requestContext);

// Security headers; images are fetched by the shop and dashboard from other origins
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            const err = new Error('CORS Not Allowed');
            err.status = 403;
            callback(err);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// Static images (served once, here — not again inside routers)
app.use(express.static(path.join(__dirname, 'public')));

// General limit for API traffic (static files above are not counted)
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT || 600),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: 'Too many requests, please slow down.' }),
}));

// Stripe needs the raw body to verify the signature, so this route comes before express.json
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), paymentRoutes.webhook);

// /chat parses its own smaller (4 KB) bodies
const jsonBody = express.json({ limit: '1mb' });
app.use((req, res, next) => (req.path.startsWith('/chat/') ? next() : jsonBody(req, res, next)));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// The secret signs the guest cookie (cf_anon) used for recommendations and guest chat
app.use(cookieParser(require('./config/env').cookieSecret()));

app.get('/', (req, res) => {
    res.send('Server is running');
});

// For uptime monitors: no secrets, just whether the pieces are up
app.get('/health', (req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
    res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, ai: require('./services/ai/client').status(), uptime: Math.round(process.uptime()) });
});

app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/category', categoryRoutes)
app.use('/product', productRoutes);
app.use('/review', reviewRoutes);
app.use('/cart', cartRoutes);
app.use('/wishlist', wishRoutes);
app.use('/stripe', paymentRoutes)
app.use('/order', orderRoutes);
// /user-Interest removed: unused, unauthenticated (anyone could read or write any user's history), unescaped regex
app.use('/api', earningRoutes)
app.use('/discount', discount)
app.use('/employee', employee);
app.use('/department', department);
app.use('/supplier', supplier);
app.use('/distributer', distributer);
app.use('/settings', settingsRoutes);
app.use('/events', require('./routes/events'));
app.use('/reco', require('./routes/reco'));
app.use('/chat', require('./routes/chat'));
app.use('/knowledge', require('./routes/knowledge'));

// Unknown routes → JSON 404 (never an HTML page)
app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// Central error handler (SHARED_DECISIONS D8): {message}; internals only in development
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    let message = err.expose ? err.message : 'Something went wrong. Please try again.';

    if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed JSON in request body'; }
    else if (err.type === 'entity.too.large') { status = 413; message = 'Request body is too large'; }
    else if (err.name === 'MulterError') { status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? `Image is too large (max ${process.env.UPLOAD_MAX_MB || 2} MB)` : err.message; }
    else if (err instanceof mongoose.Error.CastError) { status = 400; message = `Invalid ${err.path}`; }
    else if (err instanceof mongoose.Error.ValidationError) { status = 400; message = Object.values(err.errors)[0]?.message || 'Invalid data'; }
    else if (err.message === 'CORS Not Allowed') { status = 403; message = 'Origin not allowed'; }

    if (status >= 500) console.error('Unhandled error:', err);
    res.status(status).json({ message, ...(status >= 500 ? { reqId: req.id } : {}), ...(isDev && status >= 500 ? { detail: err.message } : {}) });
});

// Connect first, then accept traffic (requests no longer hang during startup)
const start = async () => {
    await connectDB();
    app.listen(PORT, () => {
        logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
    });
};

if (process.env.VERCEL) {
    // Serverless: Vercel calls the exported app; connect once per instance
    connectDB();
} else {
    start();
}

module.exports = app;
