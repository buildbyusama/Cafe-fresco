// Core regression suite: run after every step. Covers auth, catalog, cart, wishlist, discounts,
// orders (COD create/cancel, stock), roles, security and a page-error sweep of both frontends.
// Needs backend (3000), shop (3001) and dashboard (5173) running. Usage: node regression.js
const { request, chromium } = require('playwright');
const { model, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');

const ADDRESS = { fullName: 'Reg Test', phone: '+92 300 1234567', line1: '12 Test Street', city: 'Lahore', zip: '54000' };
const SENSITIVE = /"password"|resetPasswordToken|"stack"\s*:|passwordChangedAt|"embedding"/;

(async () => {
    await connect();
    const [User, Admin, Product, Category, Inventory, Order, Cart, Wishlist, Discount, Notify, Payment] =
        ['user', 'admin', 'product', 'category', 'inventory', 'order', 'cart', 'wishlist', 'discountCode', 'notification', 'payment'].map(model);
    const t = tag();
    const api = (ctx) => ctx || request.newContext({ baseURL: URL.API });
    const json = async (r) => { try { return await r.json(); } catch { return {}; } };

    // fixtures: one category, an in-stock and an out-of-stock product, a discount code
    const cat = await Category.create({ title: `Reg Cat ${t}`, description: '' });
    const pA = await Product.create({ title: `Reg Dish A ${t}`, description: 'Regression dish', price: 10, discount: 20, category: cat._id, isActive: true });
    const pB = await Product.create({ title: `Reg Dish B ${t}`, description: 'Regression dish', price: 5, category: cat._id, isActive: true });
    await Inventory.create([{ productId: pA._id, quantityInStock: 5 }, { productId: pB._id, quantityInStock: 0 }]);
    const code = await Discount.create({ code: `REG${t}`.toUpperCase().slice(0, 20), discountPercentage: 10, expiryDate: new Date(Date.now() + 864e5), maxUses: 5, minPurchase: 0, usedCount: 0, usedBy: [] });
    const email = `reg${t}@x.com`;
    const cleanup = async () => {
        const u = await User.findOne({ email });
        const orders = u ? await Order.find({ userId: u._id }) : [];
        await Promise.all([
            Notify.deleteMany({ orderId: { $in: orders.map((o) => o._id) } }),
            Payment.deleteMany({ orderId: { $in: orders.map((o) => o._id) } }),
            Order.deleteMany({ _id: { $in: orders.map((o) => o._id) } }),
            u && Cart.deleteMany({ userId: u._id }), u && Wishlist.deleteMany({ userId: u._id }), u && User.deleteOne({ _id: u._id }),
            Inventory.deleteMany({ productId: { $in: [pA._id, pB._id] } }), Product.deleteMany({ _id: { $in: [pA._id, pB._id] } }),
            Category.deleteOne({ _id: cat._id }), Discount.deleteOne({ _id: code._id }),
        ]);
    };

    try {
        // ---------- security without a session
        const anon = await api();
        for (const p of ['/user/me', '/cart/all', '/wishlist/all', '/order/user/history']) check(`guest ${p} → 401`, (await anon.get(p)).status() === 401);
        for (const p of ['/order/fetch', '/user/all', '/api/dashboard', '/admin/all']) check(`guest admin route ${p} → 401`, (await anon.get(p)).status() === 401);

        // ---------- auth
        const c = await api();
        const reg = await c.post('/user/register', { data: { name: 'Reg User', email, password: 'Regpass12' } });
        check('register 201', reg.status() === 201);
        check('register response has no token in body', !JSON.stringify(await json(reg)).includes('eyJ'));
        check('duplicate register 409', (await (await api()).post('/user/register', { data: { name: 'Reg User', email, password: 'Regpass12' } })).status() === 409);
        const me = await json(await c.get('/user/me'));
        check('/user/me returns the user', me.user?.email === email);
        const wrong = await (await api()).post('/user/login', { data: { email, password: 'Wrongpass1' } });
        check('wrong password 401 with a generic message', wrong.status() === 401 && /Invalid email or password/.test((await json(wrong)).message));

        // ---------- catalog
        const fetchRes = await json(await anon.get(`/product/fetch?category=${cat._id}&limit=10`));
        check('/product/fetch by category returns active products with stock', fetchRes.products?.length === 2 && fetchRes.products.every((p) => typeof p.inStock === 'boolean'));
        const low = await json(await anon.get(`/product/fetch?category=${cat._id}&sort=low`));
        check('price sort uses the final price', low.products?.[0]?._id === String(pB._id));
        check('/category/fetch has counts and fromPrice', (await json(await anon.get('/category/fetch'))).categories?.some((x) => x._id === String(cat._id) && x.productCount === 2 && x.fromPrice === 5));
        check('/product/:id 200', (await anon.get(`/product/${pA._id}`)).status() === 200);

        // ---------- cart
        check('add out-of-stock → 409', (await c.post('/cart/add', { data: { productId: String(pB._id), quantity: 1 } })).status() === 409);
        const add = await c.post('/cart/add', { data: { productId: String(pA._id), quantity: 2 } });
        check('add to cart 200', add.status() === 200 && (await json(add)).cart?.[0]?.price === 8);
        check('add over stock → 409', (await c.post('/cart/add', { data: { productId: String(pA._id), quantity: 4 } })).status() === 409);
        check('update quantity 200', (await c.post('/cart/update-quantity', { data: { productId: String(pA._id), quantity: 3 } })).status() === 200);

        // ---------- wishlist
        check('wishlist add 200', (await c.post('/wishlist/add', { data: { productId: String(pB._id) } })).status() === 200);
        check('wishlist lists it', (await json(await c.get('/wishlist/all'))).count === 1);
        check('wishlist remove 200', (await c.post('/wishlist/remove', { data: { productId: String(pB._id) } })).status() === 200);

        // ---------- discount + COD order
        const prev = await json(await c.post('/discount/apply', { data: { code: code.code } }));
        check('discount preview: 3 × $8 = $24, 10% off → $21.60', prev.subtotal === 24 && prev.total === 21.6, JSON.stringify(prev));
        const ord = await c.post('/order/create', { data: { shippingAddress: ADDRESS, discountCode: code.code, paymentMethod: 'cod' }, headers: { 'Idempotency-Key': `reg-${t}` } });
        const order = (await json(ord)).order;
        check('COD order 201 with server-side total', ord.status() === 201 && order?.totalAmount === 21.6);
        const replay = await c.post('/order/create', { data: { shippingAddress: ADDRESS, discountCode: code.code, paymentMethod: 'cod' }, headers: { 'Idempotency-Key': `reg-${t}` } });
        check('idempotent replay returns the same order', replay.status() === 200 && (await json(replay)).order?._id === order?._id);
        check('stock reserved (5 → 2)', (await Inventory.findOne({ productId: pA._id })).quantityInStock === 2);
        check('cart cleared after order', (await json(await c.get('/cart/all'))).cart?.length === 0);
        const hist = await json(await c.get('/order/user/history'));
        check('order history lists it without secrets', hist.orders?.length === 1 && !SENSITIVE.test(JSON.stringify(hist)));
        const other = await api();
        await other.post('/user/register', { data: { name: 'Other User', email: `reg2${t}@x.com`, password: 'Regpass12' } });
        check("another user can't cancel it (404)", (await other.post(`/order/cancel/${order._id}`)).status() === 404);
        await User.deleteOne({ email: `reg2${t}@x.com` });
        check('owner cancels 200', (await c.post(`/order/cancel/${order._id}`)).status() === 200);
        check('stock restored once (back to 5)', (await Inventory.findOne({ productId: pA._id })).quantityInStock === 5);
        check('discount released', (await Discount.findById(code._id)).usedCount === 0);

        // ---------- roles (admin APIs)
        const ad = await api();
        check('admin login 200', (await ad.post('/admin/login', { data: ADMIN })).status() === 200);
        for (const p of ['/order/fetch', '/user/all', '/api/dashboard', '/discount/fetch', '/admin/all']) check(`admin ${p} 200`, (await ad.get(p)).status() === 200);
        const ed = await api();
        const edAcc = await Admin.create({ name: 'Reg Editor', email: `rege${t}@x.com`, password: await bcrypt.hash('Regpass12', 10), role: 'editor' });
        await ed.post('/admin/login', { data: { email: edAcc.email, password: 'Regpass12' } });
        for (const p of ['/order/fetch', '/user/all', '/discount/fetch', '/admin/all']) check(`editor ${p} 403`, (await ed.get(p)).status() === 403);
        check('editor can list products', (await ed.get('/product/fetch?includeInactive=true')).status() === 200);
        check('customer cookie rejected by admin route', (await c.get('/order/fetch')).status() === 401);
        await Admin.deleteOne({ _id: edAcc._id });

        // ---------- logout
        check('logout 200', (await c.post('/user/logout')).status() === 200);
        check('after logout /user/me 401', (await c.get('/user/me')).status() === 401);

        // ---------- page-error sweep (both frontends)
        const browser = await chromium.launch();
        const errs = [];
        const shop = await browser.newPage();
        shop.on('pageerror', (e) => errs.push(`shop ${e.message}`));
        for (const p of ['/', '/products', `/product/${pA._id}`, '/about', '/contact', '/login', '/signup', '/forgot', '/cart']) {
            await shop.goto(URL.SHOP + p, { waitUntil: 'domcontentloaded' });
            await shop.waitForTimeout(900);
        }
        const dctx = await browser.newContext();
        await dctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const dash = await dctx.newPage();
        dash.on('pageerror', (e) => errs.push(`dash ${e.message}`));
        for (const p of ['/admin/dashboard', '/admin/all-product', '/admin/all-category', '/admin/all-order', '/admin/all-user', '/admin/discount-code', '/admin/all-inventory']) {
            await dash.goto(URL.DASH + p, { waitUntil: 'domcontentloaded' });
            await dash.waitForTimeout(1200);
        }
        check('no page errors on shop and dashboard pages', errs.length === 0, errs[0]);
        await browser.close();
    } finally {
        await cleanup();
    }
    await done();
})();
