// Step 1.3: embeddings + hybrid search (mock embeddings in-process; the live server has no key → keyword fallback)
process.env.AI_MOCK = 'true';
const { request } = require('playwright');
const { model, backend, URL, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory, AiUsage] = ['product', 'category', 'inventory', 'aiUsage'].map(model);
    const emb = backend('services/ai/embeddings');
    const { now } = backend('services/stats');
    const t = tag();
    const cat = await Category.create({ title: `Emb Cat ${t}` });
    const mk = (title, description, extra = {}) => Product.create({ title: `${title} ${t}`, description, price: 6, category: cat._id, ...extra });
    const pizza = await mk('Cheesy Garlic Pizza', 'Stone baked pizza with mozzarella cheese and garlic', { tags: ['cheesy', 'pizza'] });
    const juice = await mk('Fresh Orange Juice', 'Cold pressed orange juice', { tags: ['cold drink'] });
    const hidden = await mk('Secret Cheesy Pizza', 'Hidden mozzarella pizza', { isActive: false });
    const empty = await mk('Sold Out Cheesy Pizza', 'Mozzarella pizza with cheese', {});
    const ids = [pizza, juice, hidden, empty].map((p) => p._id);
    await Inventory.create([{ productId: pizza._id, quantityInStock: 4 }, { productId: juice._id, quantityInStock: 4 }, { productId: hidden._id, quantityInStock: 4 }, { productId: empty._id, quantityInStock: 0 }]);
    try {
        const first = await emb.embedProducts(ids);
        check('embeds new products', first.embedded === 4, JSON.stringify(first));
        const second = await emb.embedProducts(ids);
        check('unchanged products are skipped (hash)', second.embedded === 0 && second.skipped === 4);
        await Product.updateOne({ _id: juice._id }, { description: 'Cold pressed orange juice with mint' });
        check('changed description is re-embedded', (await emb.embedProducts(ids)).embedded === 1);

        const res = await emb.semanticSearch('cheesy pizza', { limit: 10, category: cat._id });
        const titles = res.products.map((p) => p.title);
        check('semantic mode finds the cheesy pizza first', res.mode === 'semantic' && titles[0] === pizza.title, titles.join(' | '));
        check('inactive and out-of-stock dishes are excluded', !titles.includes(hidden.title) && !titles.includes(empty.title));
        check('weak matches are dropped (juice not in a pizza search)', !titles.includes(juice.title));
        const drink = await emb.semanticSearch('cold orange drink', { limit: 3, category: cat._id });
        check('drink query → juice', drink.products[0]?.title === juice.title);
        const priced = await emb.semanticSearch('pizza', { maxPrice: 5, category: cat._id });
        check('structured filters apply (maxPrice 5 → none at $6)', priced.products.length === 0);

        // debounce: 30 quick saves → 1 embedding call
        const day = now().format('YYYY-MM-DD');
        await Product.updateOne({ _id: pizza._id }, { description: 'Stone baked pizza with extra mozzarella cheese' });
        const before = (await AiUsage.findOne({ day }).lean())?.embedCalls || 0;
        for (let i = 0; i < 30; i++) emb.scheduleEmbed(pizza._id);
        await new Promise((r) => setTimeout(r, 3500));
        const after = (await AiUsage.findOne({ day }).lean())?.embedCalls || 0;
        check('30 rapid saves → one embedding call', after - before === 1, `${after - before} calls`);

        // over HTTP (server has no key): keyword fallback, never leaks vectors
        const api = await request.newContext({ baseURL: URL.API });
        const http = await (await api.get(`/product/search?q=${encodeURIComponent(`cheesy ${t}`)}`)).json();
        check('server without a key → keyword mode, still finds it', ['keyword', 'semantic'].includes(http.mode) && http.products.some((p) => p.title === pizza.title), http.mode);
        const detail = await (await api.get(`/product/${pizza._id}`)).text();
        const list = await (await api.get(`/product/fetch?category=${cat._id}`)).text();
        check('embedding never in API responses', !/embedding/i.test(detail) && !/embedding/i.test(list) && !/embedding/i.test(JSON.stringify(http)));
        check('query too short → 400', (await api.get('/product/search?q=a')).status() === 400);
        let limited = false;
        for (let i = 0; i < 32 && !limited; i++) limited = (await api.get(`/product/search?q=rate${i}`)).status() === 429;
        check('search is rate limited (30/min)', limited);
    } finally {
        await Inventory.deleteMany({ productId: { $in: ids } });
        await Product.deleteMany({ _id: { $in: ids } });
        await Category.deleteOne({ _id: cat._id });
    }
    await done();
})();
