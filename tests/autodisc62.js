// Step 6.2: automatic discount (best eligible code, skips ineligible, typed code wins, Remove sticks, order total, dashboard switch)
const { request, chromium } = require('playwright');
const { model, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory, Discount, User, Cart, Order, Payment, Notify] = ['product', 'category', 'inventory', 'discountCode', 'user', 'cart', 'order', 'payment', 'notification'].map(model);
    const t = tag().toUpperCase();
    const cat = await Category.create({ title: `Auto Cat ${t}` });
    const dish = await Product.create({ title: `Auto Dish ${t}`, description: 'x', price: 20, category: cat._id });
    await Inventory.create({ productId: dish._id, quantityInStock: 50 });
    const day = 864e5;
    const mk = (suffix, pct, extra = {}) => ({ code: `A${suffix}${t}`.slice(0, 20), discountPercentage: pct, expiryDate: new Date(Date.now() + 10 * day), maxUses: 100, minPurchase: 0, autoApply: true, ...extra });
    const codes = await Discount.create([
        mk('TEN', 10),
        mk('FIFT', 15, { expiryDate: new Date(Date.now() + 2 * day) }), // best eligible
        mk('FIFL', 15, { expiryDate: new Date(Date.now() + 9 * day) }), // same saving, expires later
        mk('MIN', 50, { minPurchase: 1000 }), // below minimum
        mk('OFF', 60, { isActive: false }),
        mk('USED', 70, { maxUses: 1, usedCount: 1 }),
        mk('MANUAL', 80, { autoApply: false }), // not automatic
        { code: `TYPED${t}`.slice(0, 20), discountPercentage: 5, expiryDate: new Date(Date.now() + 10 * day), maxUses: 100, autoApply: false },
    ]);
    const best = codes[1].code;
    const email = `auto${t.toLowerCase()}@x.com`;
    try {
        const c = await request.newContext({ baseURL: URL.API });
        await c.post('/user/register', { data: { name: 'Auto Disc', email, password: 'Autodisc1' } });
        check('empty cart → no code', (await (await c.post('/discount/best')).json()).code === null);
        await c.post('/cart/add', { data: { productId: String(dish._id), quantity: 2 } });
        const b1 = await (await c.post('/discount/best')).json();
        check('best eligible: 15% that expires soonest (skips min, inactive, used up, not automatic)', b1.code === best && b1.discountAmount === 6, JSON.stringify(b1));
        check('guest → 401', (await (await request.newContext({ baseURL: URL.API })).post('/discount/best')).status() === 401);

        const br = await chromium.launch();
        const ctx = await br.newContext({ storageState: await c.storageState(), viewport: { width: 1366, height: 900 } });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(`${URL.SHOP}/cart`);
        await p.getByText(`We applied ${best} for you`).first().waitFor({ timeout: 15000 });
        check('cart applies it automatically and says so', /your best available code/.test(await p.locator('main').innerText()));
        check('cart total uses it ($40 − $6 = $34)', (await p.getByTestId('cart-total').innerText()).includes('34.00'));
        await p.getByRole('button', { name: /remove/i }).filter({ hasText: /remove/i }).last().click();
        await p.waitForTimeout(1500);
        await p.reload();
        await p.waitForTimeout(3000);
        check('Remove sticks for the visit (not re-applied after reload)', !/We applied/.test(await p.locator('main').innerText()) && (await p.getByTestId('cart-total').innerText()).includes('40.00'));
        await p.locator('#discountCode').fill(codes[7].code);
        await p.getByRole('button', { name: 'Apply' }).click();
        await p.waitForTimeout(1500);
        check('a typed code applies normally (and is not labelled automatic)', new RegExp(`Code ${codes[7].code} applied`).test(await p.locator('main').innerText()));
        check('no page errors', errs.length === 0, errs[0]);
        await br.close();

        // a fresh visit with the auto code → order total matches the server
        const c2 = await request.newContext({ baseURL: URL.API });
        await c2.post('/user/login', { data: { email, password: 'Autodisc1' } });
        const pick = await (await c2.post('/discount/best')).json();
        const ord = await c2.post('/order/create', { data: { shippingAddress: { fullName: 'Auto', phone: '+92 300 1234567', line1: '1 Auto St', city: 'Lahore', zip: '54000' }, discountCode: pick.code, paymentMethod: 'cod' } });
        check('order placed with the auto code: server total $34', ord.status() === 201 && (await ord.json()).order.totalAmount === 34);
        check('after using it, the next best code is offered', (await (await c2.post('/cart/add', { data: { productId: String(dish._id), quantity: 1 } })).status()) === 200 && (await (await c2.post('/discount/best')).json()).code === codes[2].code);

        // dashboard switch saves autoApply
        const ad = await request.newContext({ baseURL: URL.API });
        await ad.post('/admin/login', { data: ADMIN });
        await ad.put(`/discount/update/${codes[0]._id}`, { data: { autoApply: false } });
        check('dashboard can turn "apply automatically" off', (await Discount.findById(codes[0]._id)).autoApply === false);
    } finally {
        const u = await User.findOne({ email });
        if (u) {
            const orders = await Order.find({ userId: u._id });
            await Promise.all([Payment.deleteMany({ orderId: { $in: orders.map((o) => o._id) } }), Notify.deleteMany({ orderId: { $in: orders.map((o) => o._id) } }), Order.deleteMany({ userId: u._id }), Cart.deleteMany({ userId: u._id }), User.deleteOne({ _id: u._id })]);
        }
        await Discount.deleteMany({ _id: { $in: codes.map((x) => x._id) } });
        await Inventory.deleteMany({ productId: dish._id });
        await Product.deleteOne({ _id: dish._id });
        await Category.deleteOne({ _id: cat._id });
    }
    await done();
})();
