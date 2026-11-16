// Step 2.1: behaviour events (trusted server events, untrusted client events, guest cookie, merge on login, limits)
const { request, chromium } = require('playwright');
const { model, URL, check, connect, done, tag } = require('./lib');
const ADDRESS = { fullName: 'Ev Test', phone: '+92 300 1234567', line1: '1 Event Road', city: 'Lahore', zip: '54000' };
(async () => {
    await connect();
    const [Product, Category, Inventory, UserEvent, User, Order, Cart, Payment, Notify] = ['product', 'category', 'inventory', 'userEvent', 'user', 'order', 'cart', 'payment', 'notification'].map(model);
    const t = tag();
    const cat = await Category.create({ title: `Ev Cat ${t}` });
    const p = await Product.create({ title: `Ev Dish ${t}`, description: 'event dish', price: 4, category: cat._id });
    const off = await Product.create({ title: `Ev Off ${t}`, description: 'inactive', price: 4, category: cat._id, isActive: false });
    await Inventory.create([{ productId: p._id, quantityInStock: 9 }, { productId: off._id, quantityInStock: 9 }]);
    const email = `ev${t}@x.com`;
    try {
        const idx = await UserEvent.collection.indexes();
        check('TTL index (180 days) exists', idx.some((i) => i.expireAfterSeconds === 180 * 86400));

        // guest: view + search create a signed cf_anon cookie
        const guest = await request.newContext({ baseURL: URL.API });
        const v = await guest.post('/events', { data: { type: 'view', productId: String(p._id), userId: '000000000000000000000000' } });
        check('guest view → 202', v.status() === 202);
        const anonCookie = (await guest.storageState()).cookies.find((c) => c.name === 'cf_anon');
        check('signed httpOnly guest cookie set', !!anonCookie && anonCookie.httpOnly && anonCookie.value.startsWith('s%3A'));
        await guest.post('/events', { data: { type: 'search', query: '  Cheesy <b>PIZZA</b>  please tell me everything about cheese and more cheese and more and more cheese ok  ' } });
        await new Promise((r) => setTimeout(r, 500));
        const gEvents = await UserEvent.find({ productId: p._id, type: 'view' }).lean();
        check('forged userId in the body is ignored (stored as guest)', gEvents.length === 1 && gEvents[0].userId === null && /^[a-f0-9]{32}$/.test(gEvents[0].anonId));
        const anonId = gEvents[0].anonId;
        const s = await UserEvent.findOne({ anonId, type: 'search' }).lean();
        check('search query cleaned, lower-cased and cut to 80 chars', s && !/[<>]/.test(s.query) && s.query === s.query.toLowerCase() && s.query.length <= 80, s?.query);
        check('bad type → 400', (await guest.post('/events', { data: { type: 'purchase', productId: String(p._id) } })).status() === 400);
        check('unknown product → 400', (await guest.post('/events', { data: { type: 'view', productId: '000000000000000000000000' } })).status() === 400);
        check('inactive product → 400', (await guest.post('/events', { data: { type: 'view', productId: String(off._id) } })).status() === 400);
        check('short search → 400', (await guest.post('/events', { data: { type: 'search', query: 'ab' } })).status() === 400);
        // a tampered cookie is treated as no cookie
        const forged = await request.newContext({ baseURL: URL.API, extraHTTPHeaders: { cookie: `cf_anon=${anonId}` } });
        await forged.post('/events', { data: { type: 'view', productId: String(p._id) } });
        await new Promise((r) => setTimeout(r, 400));
        check("an unsigned cookie can't write into another guest's history", (await UserEvent.countDocuments({ anonId, type: 'view' })) === 1);

        // signup merges the guest history
        const reg = await guest.post('/user/register', { data: { name: 'Ev User', email, password: 'Evpass123' } });
        const user = await User.findOne({ email });
        await new Promise((r) => setTimeout(r, 400));
        check('signup merges guest events into the account', reg.status() === 201 && (await UserEvent.countDocuments({ userId: user._id })) >= 2 && (await UserEvent.countDocuments({ anonId })) === 0);
        check('guest cookie cleared after login', !(await guest.storageState()).cookies.some((c) => c.name === 'cf_anon' && c.value));

        // trusted server events
        await guest.post('/cart/add', { data: { productId: String(p._id), quantity: 2 } });
        const key = `ev-${t}`;
        const o1 = await guest.post('/order/create', { data: { shippingAddress: ADDRESS, paymentMethod: 'cod' }, headers: { 'Idempotency-Key': key } });
        const o2 = await guest.post('/order/create', { data: { shippingAddress: ADDRESS, paymentMethod: 'cod' }, headers: { 'Idempotency-Key': key } });
        await new Promise((r) => setTimeout(r, 600));
        check('add_to_cart recorded with quantity', (await UserEvent.findOne({ userId: user._id, type: 'add_to_cart' }).lean())?.quantity === 2);
        check('one purchase per line; an idempotent replay adds none', o1.status() === 201 && o2.status() === 200 && (await UserEvent.countDocuments({ userId: user._id, type: 'purchase' })) === 1);
        const logged = await guest.post('/events', { data: { type: 'view', productId: String(p._id) } });
        await new Promise((r) => setTimeout(r, 400));
        check('logged-in view stored under the user, not a guest id', logged.status() === 202 && (await UserEvent.countDocuments({ userId: user._id, type: 'view', anonId: null })) >= 2);

        // shop sends a view once per visit
        const b = await chromium.launch();
        const page = await b.newPage();
        const posts = [];
        page.on('request', (r) => r.url().endsWith('/events') && r.method() === 'POST' && posts.push(r.postDataJSON()));
        await page.goto(`${URL.SHOP}/product/${p._id}`);
        await page.waitForTimeout(1200);
        await page.reload();
        await page.waitForTimeout(1200);
        check('product page sends one view per visit', posts.filter((x) => x.type === 'view').length === 1);
        await page.goto(`${URL.SHOP}/products?q=pancake`);
        await page.waitForTimeout(1200);
        check('menu search sends a search event', posts.some((x) => x.type === 'search' && x.query === 'pancake'));
        await b.close();

        let limited = false;
        const spam = await request.newContext({ baseURL: URL.API });
        for (let i = 0; i < 65 && !limited; i++) limited = (await spam.post('/events', { data: { type: 'search', query: `spam ${i}` } })).status() === 429;
        check('events are rate limited (60/min)', limited);
    } finally {
        const u = await User.findOne({ email });
        const orders = u ? await Order.find({ userId: u._id }) : [];
        await Promise.all([
            UserEvent.deleteMany({ $or: [{ productId: { $in: [p._id, off._id] } }, ...(u ? [{ userId: u._id }] : []), { query: /^spam \d+$/ }] }),
            Payment.deleteMany({ orderId: { $in: orders.map((o) => o._id) } }),
            Notify.deleteMany({ orderId: { $in: orders.map((o) => o._id) } }),
            Order.deleteMany({ _id: { $in: orders.map((o) => o._id) } }),
            u && Cart.deleteMany({ userId: u._id }), u && User.deleteOne({ _id: u._id }),
            Inventory.deleteMany({ productId: { $in: [p._id, off._id] } }), Product.deleteMany({ _id: { $in: [p._id, off._id] } }), Category.deleteOne({ _id: cat._id }),
        ]);
    }
    await done();
})();
