// Step 5.4: popular items (ranking, only completed orders, ranges, renamed/deleted dishes, roles, card)
const { request, chromium } = require('playwright');
const { model, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Order, Product, Category, User, Admin] = ['order', 'product', 'category', 'user', 'admin'].map(model);
    const t = tag();
    const cat = await Category.create({ title: `Pop Cat ${t}` });
    const [a, b, c] = await Product.create([1, 2, 3].map((i) => ({ title: `Pop Dish ${i} ${t}`, description: 'x', price: 5, category: cat._id })));
    const u = await User.create({ name: 'Pop', email: `pop${t}@x.com`, password: 'x' });
    const addr = { fullName: 'P', phone: '+92 300 1234567', line1: 'x street', city: 'Lahore', zip: '54000' };
    const line = (p, quantity, title = p.title) => ({ productId: p._id, title, unitPrice: 5, quantity, lineTotal: 5 * quantity });
    const mk = (lines, orderStatus, daysAgo) => ({ userId: u._id, products: lines, subtotal: 1, totalAmount: 1, shippingAddress: addr, paymentMethod: 'cod', paymentStatus: orderStatus === 'completed' ? 'paid' : 'unpaid', orderStatus, createdAt: new Date(Date.now() - daysAgo * 864e5) });
    await Order.insertMany([
        mk([line(a, 50), line(b, 30)], 'completed', 1),
        mk([line(b, 25, `Old name ${t}`)], 'completed', 2), // b renamed since: still one row (55 total)
        mk([line(c, 500)], 'cancelled', 1), // cancelled: ignored
        mk([line(c, 400)], 'pending', 1), // pending: ignored
        mk([line(a, 40)], 'completed', 20), // inside 30d, outside 7d
    ]);
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const ed = await Admin.create({ name: 'Pop Ed', email: `pope${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' });
    try {
        const get = async (range) => (await (await ad.get(`/api/popular?range=${range}`)).json()).items;
        const mine = (items) => items.filter((i) => [a, b, c].some((p) => String(p._id) === String(i.productId)));
        const week = mine(await get('7d'));
        check('7 days: b (55, renamed) above a (50); one row per dish', week.length === 2 && String(week[0].productId) === String(b._id) && week[0].quantity === 55 && week[1].quantity === 50, JSON.stringify(week.map((x) => [x.title, x.quantity])));
        check('cancelled and pending orders are not counted', !week.some((i) => String(i.productId) === String(c._id)));
        check('current product title shown (not the old one)', week[0].title === b.title);
        const month = mine(await get('30d'));
        check('30 days includes the older order (a = 90)', month.find((i) => String(i.productId) === String(a._id))?.quantity === 90);
        check('revenue = quantity × price', month.find((i) => String(i.productId) === String(a._id))?.revenue === 450);
        await Product.deleteOne({ _id: b._id });
        const after = mine(await get('7d')).find((i) => String(i.productId) === String(b._id));
        check('deleted dish keeps its stored title and is marked not on the menu', after && after.title === `Pop Dish 2 ${t}` && after.stillOnMenu === false, JSON.stringify(after));
        check('invalid range falls back to 30 days', (await (await ad.get('/api/popular?range=forever')).json()).range === '30d');
        const e = await request.newContext({ baseURL: URL.API });
        await e.post('/admin/login', { data: { email: ed.email, password: 'Pass1234' } });
        check('editor → 403', (await e.get('/api/popular')).status() === 403);

        const br = await chromium.launch();
        const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (x) => errs.push(x.message));
        await p.goto(`${URL.DASH}/admin/dashboard`);
        await p.getByText('Popular items').waitFor({ timeout: 45000 });
        await p.waitForTimeout(1500);
        check('dashboard shows Popular items and keeps Today\'s latest orders', (await p.getByText("Today's latest orders").count()) === 1 && (await p.getByText(/\d+ sold/).count()) > 0);
        await p.getByRole('button', { name: 'This year' }).click();
        await p.waitForTimeout(1200);
        check('range buttons reload the list', (await p.getByText(/\d+ sold/).count()) > 0);
        if (process.argv[2]) await p.getByText('Popular items').locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]').screenshot({ path: `${process.argv[2]}/popular.png` });
        check('no page errors', errs.length === 0, errs[0]);
        await br.close();
    } finally {
        await Order.deleteMany({ userId: u._id });
        await User.deleteOne({ _id: u._id });
        await Product.deleteMany({ _id: { $in: [a._id, b._id, c._id] } });
        await Category.deleteOne({ _id: cat._id });
        await Admin.deleteOne({ _id: ed._id });
    }
    await done();
})();
