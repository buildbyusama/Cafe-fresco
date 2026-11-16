// Step 2.2: recommendation engine (trending + decay, diversity, stock/active rules, for-me isolation, similar, cart, latency)
const { request } = require('playwright');
const { model, backend, bcrypt, URL, check, connect, done, tag, mongoose } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory, UserEvent, User, Order] = ['product', 'category', 'inventory', 'userEvent', 'user', 'order'].map(model);
    const reco = backend('services/recommendations');
    const t = tag();
    const mains = await Category.create({ title: `Reco Mains ${t}` });
    const drinks = await Category.create({ title: `Reco Drinks ${t}` });
    const mk = (title, category, extra = {}) => Product.create({ title: `${title} ${t}`, description: 'reco test', price: 5, category: category._id, ...extra });
    const [m1, m2, m3, m4, d1, d2, off, gone] = await Promise.all([
        mk('Burger A', mains, { tags: ['grilled', 'beef'] }), mk('Burger B', mains, { tags: ['grilled', 'beef'] }), mk('Burger C', mains, { tags: ['grilled'] }), mk('Pasta D', mains, { tags: ['pasta'] }),
        mk('Shake E', drinks, { tags: ['cold drink'] }), mk('Juice F', drinks, { tags: ['cold drink'] }), mk('Inactive G', mains, { isActive: false }), mk('Sold Out H', mains),
    ]);
    const all = [m1, m2, m3, m4, d1, d2, off, gone];
    await Inventory.create(all.map((p) => ({ productId: p._id, quantityInStock: p === gone ? 0 : 20 })));
    const users = await User.create([1, 2].map((i) => ({ name: `Reco ${i}`, email: `reco${i}${t}@x.com`, password: 'x' })));
    const now = Date.now();
    const ev = (p, type, quantity, daysAgo, userId = users[1]._id) => ({ userId, type, productId: p._id, quantity, at: new Date(now - daysAgo * 864e5) });
    await UserEvent.insertMany([
        // trending: m1 > m2 > m3 (all recent), d1 strong but 6 days old (decayed), off/gone very strong but must never show
        ev(m1, 'purchase', 10, 0.1), ev(m2, 'purchase', 8, 0.1), ev(m3, 'purchase', 7, 0.1), ev(d1, 'purchase', 10, 6.5),
        ev(off, 'purchase', 50, 0.1), ev(gone, 'purchase', 50, 0.1), ev(m4, 'view', 1, 0.1),
        // user 0 likes drinks; user 1's history is the burgers above
        ev(d1, 'view', 1, 0.2, users[0]._id), ev(d2, 'add_to_cart', 1, 0.2, users[0]._id),
    ]);
    // bought together: m1 with d2
    await Order.create({ userId: users[1]._id, products: [{ productId: m1._id, title: m1.title, unitPrice: 5, quantity: 1, lineTotal: 5 }, { productId: d2._id, title: d2.title, unitPrice: 5, quantity: 1, lineTotal: 5 }], subtotal: 10, totalAmount: 10, shippingAddress: { fullName: 'R', phone: '+92 300 1234567', line1: 'x street', city: 'Lahore', zip: '54000' }, paymentMethod: 'cod', paymentStatus: 'paid', orderStatus: 'completed' });
    reco.bust();
    const ids = (list) => list.map(String);
    const name = (id) => all.find((p) => String(p._id) === String(id))?.title.replace(` ${t}`, '') || 'other';
    try {
        const tr = ids(await reco.trending());
        const mine = tr.filter((id) => all.some((p) => String(p._id) === id));
        check('trending order m1 > m2 (recent purchases first)', mine.indexOf(String(m1._id)) === 0 && mine.indexOf(String(m2._id)) === 1, mine.map(name).join(','));
        check('decay: 6-day-old purchase ranks below fresh ones', mine.indexOf(String(d1._id)) > mine.indexOf(String(m2._id)));
        check('diversity: at most 2 per category among the top', mine.slice(0, 3).filter((id) => [m1, m2, m3, m4].some((p) => String(p._id) === id)).length <= 2);
        check('inactive and out-of-stock never recommended', !tr.includes(String(off._id)) && !tr.includes(String(gone._id)));
        check('list has 8 items', tr.length === 8);

        const u0 = await reco.forUser({ userId: users[0]._id });
        check('for-me (drinks lover) → drinks first, personal', u0.personal && [d1, d2].some((p) => String(p._id) === String(u0.ids[0])), name(u0.ids[0]));
        const u1 = await reco.forUser({ userId: users[1]._id });
        check("another user's history doesn't leak (burger fan gets mains first)", u1.personal && [m1, m2, m3, m4].some((p) => String(p._id) === String(u1.ids[0])), name(u1.ids[0]));
        const cold = await reco.forUser({ userId: new mongoose.Types.ObjectId() });
        check('cold start → trending, not personal', !cold.personal && cold.ids.length === 8);
        check('guest without cookie → trending', !(await reco.forUser({})).personal);

        const sim = ids(await reco.similar(m1._id));
        check('similar: never itself, same-tag burgers first', !sim.includes(String(m1._id)) && [m2, m3].some((p) => String(p._id) === sim[0]), sim.slice(0, 3).map(name).join(','));
        check('similar: unknown product → null', (await reco.similar(new mongoose.Types.ObjectId())) === null);

        const cart = ids(await reco.withCart([m1._id]));
        check('cart: bought-together drink first, cart items excluded', cart[0] === String(d2._id) && !cart.includes(String(m1._id)), cart.slice(0, 3).map(name).join(','));

        await Product.updateOne({ _id: m1._id }, { isActive: false });
        backend('services/ai/embeddings').bust();
        check('deactivated dish disappears once the cache is busted', !ids(await reco.trending()).includes(String(m1._id)));
        await Product.updateOne({ _id: m1._id }, { isActive: true });
        reco.bust();

        // HTTP
        const api = await request.newContext({ baseURL: URL.API });
        const tj = await (await api.get('/reco/trending')).json();
        check('GET /reco/trending → products with stock, no vectors', tj.products.length === 8 && tj.products.every((p) => typeof p.inStock === 'boolean' && !('embedding' in p)));
        check('GET /reco/similar bad id → 400', (await api.get('/reco/similar/nope')).status() === 400);
        check('POST /reco/cart too many ids → 400', (await api.post('/reco/cart', { data: { productIds: Array(51).fill(String(m1._id)) } })).status() === 400);
        const fm = await api.get(`/reco/for-me?userId=${users[0]._id}`);
        check("for-me ignores a userId in the query (guest stays non-personal)", (await fm.json()).personal === false);

        // latency with 10k events
        await UserEvent.insertMany(Array.from({ length: 10000 }, (_, i) => ev([m1, m2, m3, m4, d1, d2][i % 6], 'view', 1, (i % 7) + 0.01, users[1]._id)));
        const times = [];
        for (let i = 0; i < 20; i++) {
            reco.bust();
            const s = Date.now();
            await reco.trending();
            times.push(Date.now() - s);
        }
        times.sort((a, b) => a - b);
        check('trending p95 < 150 ms with 10k events (cold cache)', times[18] < 150, `p95 ${times[18]} ms`);
    } finally {
        await UserEvent.deleteMany({ $or: [{ userId: { $in: users.map((u) => u._id) } }, { productId: { $in: all.map((p) => p._id) } }] });
        await Order.deleteMany({ userId: users[1]._id });
        await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
        await Inventory.deleteMany({ productId: { $in: all.map((p) => p._id) } });
        await Product.deleteMany({ _id: { $in: all.map((p) => p._id) } });
        await Category.deleteMany({ _id: { $in: [mains._id, drinks._id] } });
        reco.bust();
    }
    await done();
})();
