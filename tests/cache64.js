// Step 6.4: response cache correctness (hits, admin bypass, admin changes show at once, personal routes never shared)
const { request } = require('playwright');
const { model, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory] = ['product', 'category', 'inventory'].map(model);
    const t = tag();
    const cat = await Category.create({ title: `Cache Cat ${t}` });
    const p = await Product.create({ title: `Cache Dish ${t}`, description: 'x', price: 9, category: cat._id });
    await Inventory.create({ productId: p._id, quantityInStock: 5 });
    const guest = await request.newContext({ baseURL: URL.API });
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const url = `/product/fetch?category=${cat._id}&cachetest=${t}`;
    try {
        const a = await guest.get(url);
        const b = await guest.get(url);
        check('first request MISS, second HIT', a.headers()['x-cache'] === 'MISS' && b.headers()['x-cache'] === 'HIT');
        check('cached body identical', JSON.stringify(await a.json()) === JSON.stringify(await b.json()));
        check('admin requests bypass the shared cache', !(await ad.get(url)).headers()['x-cache']);
        // admin edits the price → guests see it immediately
        await ad.put(`/product/update/${p._id}`, { multipart: { price: '12' } });
        await new Promise((r) => setTimeout(r, 300));
        const after = await guest.get(url);
        check('an admin change clears the cache (new price at once)', after.headers()['x-cache'] === 'MISS' && (await after.json()).products[0].price === 12);
        // inactive dish disappears at once
        await ad.put(`/product/update/${p._id}`, { multipart: { isActive: 'false' } });
        await new Promise((r) => setTimeout(r, 300));
        check('deactivated dish gone at once', (await (await guest.get(url)).json()).products.length === 0);
        // personal endpoint never shared
        const fm1 = await guest.get('/reco/for-me');
        check('/reco/for-me is never cached', !fm1.headers()['x-cache']);
        check('POST /reco/cart is never cached', !(await guest.post('/reco/cart', { data: { productIds: [] } })).headers()['x-cache']);
        check('chat and cart are untouched by the cache', !(await guest.get('/cart/all')).headers()['x-cache']);
    } finally {
        await Inventory.deleteMany({ productId: p._id });
        await Product.deleteOne({ _id: p._id });
        await Category.deleteOne({ _id: cat._id });
    }
    await done();
})();
