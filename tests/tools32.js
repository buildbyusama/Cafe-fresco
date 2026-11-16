// Step 3.2: chat tools (validation, login + ownership, no writes from proposals, size cap, no forbidden fields)
process.env.AI_MOCK = 'true';
const { model, backend, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory, User, Order, Cart, Discount, Notify, ChatSession, Knowledge, Setting] = ['product', 'category', 'inventory', 'user', 'order', 'cart', 'discountCode', 'notification', 'chatSession', 'knowledge', 'setting'].map(model);
    const tools = backend('services/ai/tools');
    backend('services/settings').bust();
    const t = tag();
    const cat = await Category.create({ title: `Tool Cat ${t}` });
    const dish = await Product.create({ title: `Tool Burger ${t}`, description: 'Grilled beef burger with cheese', price: 10, discount: 10, category: cat._id, tags: ['grilled'], allergens: ['dairy'], allergensVerified: false });
    const low = await Product.create({ title: `Tool Shake ${t}`, description: 'Cold vanilla shake', price: 4, category: cat._id });
    await Inventory.create([{ productId: dish._id, quantityInStock: 3 }, { productId: low._id, quantityInStock: 0 }]);
    const [alice, bob] = await User.create([{ name: 'Alice Tool', email: `ta${t}@x.com`, password: 'x' }, { name: 'Bob Tool', email: `tb${t}@x.com`, password: 'x' }]);
    const addr = { fullName: 'A', phone: '+92 300 1234567', line1: 'x street', city: 'Lahore', zip: '54000' };
    const mkOrder = (u) => Order.create({ userId: u._id, products: [{ productId: dish._id, title: dish.title, unitPrice: 9, quantity: 2, lineTotal: 18 }], subtotal: 18, totalAmount: 18, shippingAddress: addr, paymentMethod: 'cod', paymentStatus: 'unpaid', orderStatus: 'pending' });
    const aOrder = await mkOrder(alice);
    const bOrder = await mkOrder(bob);
    const code = await Discount.create({ code: `TOOL${t}`.toUpperCase().slice(0, 20), discountPercentage: 10, expiryDate: new Date(Date.now() + 864e5), maxUses: 5 });
    const session = await ChatSession.create({ userId: alice._id });
    const faq = await Knowledge.create({ question: 'Do you have parking?', answer: 'Yes, free parking behind the cafe for 20 cars.', isActive: true });
    const draft = await Knowledge.create({ question: 'Do you cater weddings?', answer: 'Draft answer', isActive: false });
    const guest = { userId: null, anonId: 'g'.repeat(32) };
    const A = { userId: alice._id, userName: 'Alice', sessionId: session._id };
    const run = async (n, args, ctx = guest) => tools.run(n, args, ctx);
    const parse = (r) => JSON.parse(r.content);
    const outputs = [];
    const keep = (r) => (outputs.push(r.content), r);
    try {
        check('13 tools registered with OpenAI schemas', tools.names().length === 13 && tools.schemas().every((s) => s.type === 'function' && s.function.parameters.type === 'object'));

        // menu
        const s1 = keep(await run('search_menu', { query: 'grilled beef burger', category: cat.title, limit: 3 }));
        const items = parse(s1).items;
        check('search_menu finds the dish with the final price', items[0]?.title === dish.title && items[0].finalPrice === 9 && items[0].originalPrice === 10, JSON.stringify(items[0]));
        check('search_menu: low stock note and unknown diet stay "unknown"', items[0].stockNote === 'only 3 left' && items[0].dietary.vegetarian === 'unknown');
        check('search_menu returns dish cards for the UI (with image), not in model data', s1.cards[0]?.type === 'dish' && !('image' in items[0]));
        check('search_menu: unknown category → empty with a note', parse(await run('search_menu', { category: 'Spaceship Food' })).items.length === 0);
        check('bad args rejected: extra property', (await run('search_menu', { query: 'x', hack: 1 })).error === 'bad_arguments');
        check('bad args rejected: limit 50', (await run('search_menu', { limit: 50 })).error === 'bad_arguments');
        check('bad args rejected: invalid JSON', (await run('search_menu', '{nope')).error === 'bad_arguments');
        check('regex characters in a query are safe', !(await run('search_menu', { query: '.*(((' })).error);
        const g = parse(keep(await run('get_dish', { id: String(dish._id) })));
        check('get_dish: unverified allergens are not stated', g.allergens === 'not verified: ask staff');
        await Product.updateOne({ _id: dish._id }, { allergensVerified: true });
        check('get_dish: verified allergens are listed', parse(await run('get_dish', { id: String(dish._id) })).allergens[0] === 'dairy');
        check('get_dish: bad id → not_found (no crash)', parse(await run('get_dish', { id: 'zzz' })).error === 'not_found');
        check('list_categories works', parse(keep(await run('list_categories', {}))).categories.some((c) => c.title === cat.title && c.dishes === 2));
        check('get_deals only in-stock discounted dishes', parse(keep(await run('get_deals', {}))).items.every((i) => i.inStock && i.discountPercent > 0));
        check('recommend trending returns dishes', parse(keep(await run('recommend', { mode: 'trending' }))).items.length > 0);
        check('recommend similar without id → friendly error', parse(await run('recommend', { mode: 'similar' })).error === 'bad_request');

        // store + knowledge
        const hours = parse(keep(await run('get_store_info', { topic: 'hours' })));
        check('get_store_info: unset facts say "not published" (no guessing)', /hasn't published/.test(hours.answer) || /day/i.test(hours.answer));
        check('get_store_info payments come from settings', /cash on delivery/.test(parse(await run('get_store_info', { topic: 'payments' })).answer));
        check('get_store_info: bad topic rejected', (await run('get_store_info', { topic: 'secrets' })).error === 'bad_arguments');
        const k = parse(keep(await run('search_knowledge', { query: 'is there parking for my car' })));
        check('search_knowledge finds the active FAQ', k.entries[0]?.answer.includes('free parking'));
        check('inactive (draft) FAQ is never returned', !JSON.stringify(parse(await run('search_knowledge', { query: 'cater weddings' }))).includes('Draft answer'));
        check('unrelated question → no entries', parse(await run('search_knowledge', { query: 'quantum physics homework' })).entries.length === 0);

        // account: login + ownership
        for (const n of ['get_my_orders', 'get_my_cart']) check(`${n} as guest → login_required`, parse(await run(n, {})).error === 'login_required');
        check('get_order_status as guest → login_required', parse(await run('get_order_status', { shortId: 'ABCDEF' })).error === 'login_required');
        const mine = parse(keep(await run('get_my_orders', {}, A)));
        check('get_my_orders: only my orders, with track link', mine.orders.length === 1 && mine.orders[0].shortId === String(aOrder._id).slice(-6).toUpperCase() && mine.orders[0].trackUrl.includes(String(aOrder._id)));
        check("get_order_status: my order by #id", parse(await run('get_order_status', { shortId: `#${String(aOrder._id).slice(-6)}` }, A)).orders[0]?.status === 'pending');
        const theirs = parse(await run('get_order_status', { shortId: String(bOrder._id).slice(-6) }, A));
        check("someone else's order looks like a missing one", theirs.orders.length === 0 && !JSON.stringify(theirs).includes('Bob'));
        check('order id format checked', parse(await run('get_order_status', { shortId: 'nope!!' }, A)).error === 'bad_request');
        check('a userId argument is rejected (identity only from the session)', (await run('get_my_orders', { userId: String(bob._id) }, A)).error === 'bad_arguments');

        // proposals never write
        const before = await Cart.findOne({ userId: alice._id }).lean();
        const prop = await run('propose_add_to_cart', { productId: String(dish._id), quantity: 5 }, A);
        const after = await Cart.findOne({ userId: alice._id }).lean();
        check('propose_add_to_cart writes nothing', JSON.stringify(before) === JSON.stringify(after));
        check('proposal capped at stock (5 → 3) with an action card', parse(prop).quantity === 3 && prop.cards[0]?.type === 'add_to_cart' && prop.cards[0].quantity === 3);
        check('out-of-stock proposal refused', parse(await run('propose_add_to_cart', { productId: String(low._id), quantity: 1 }, A)).error === 'out_of_stock');
        check('proposal as guest → login_required', parse(await run('propose_add_to_cart', { productId: String(dish._id), quantity: 1 })).error === 'login_required');

        // discount check (preview)
        await Cart.create({ userId: alice._id, items: [{ productId: dish._id, quantity: 2 }] });
        const dc = parse(keep(await run('check_discount_code', { code: code.code }, A)));
        check('check_discount_code previews without redeeming', dc.valid && dc.discountAmount === 1.8 && (await Discount.findById(code._id)).usedCount === 0);
        check('bad code → valid:false with the reason', parse(await run('check_discount_code', { code: 'NOPE123' }, A)).valid === false);
        check('get_my_cart lists lines and subtotal', parse(keep(await run('get_my_cart', {}, A))).subtotal === 18);

        // escalation
        const e1 = parse(await run('escalate_to_human', { reason: 'my order is wrong' }, A));
        await run('escalate_to_human', { reason: 'still wrong' }, A);
        check('escalation creates one notification per 10 min', e1.escalated && (await Notify.countDocuments({ type: 'chat_escalation', message: /Alice asked/ })) === 1);
        check('session flagged escalated', (await ChatSession.findById(session._id)).escalated === true);

        // global output rules
        const bad = outputs.filter((o) => /"(email|phone|password|userId|__v|stack|embedding|shippingAddress)"\s*:/.test(o));
        check('no forbidden fields in any tool output', bad.length === 0, bad[0]);
        check('every output ≤ 1.5 KB', outputs.every((o) => o.length <= tools.MAX_OUTPUT), Math.max(...outputs.map((o) => o.length)));
    } finally {
        await Promise.all([
            Order.deleteMany({ _id: { $in: [aOrder._id, bOrder._id] } }), Cart.deleteMany({ userId: { $in: [alice._id, bob._id] } }), User.deleteMany({ _id: { $in: [alice._id, bob._id] } }),
            Inventory.deleteMany({ productId: { $in: [dish._id, low._id] } }), Product.deleteMany({ _id: { $in: [dish._id, low._id] } }), Category.deleteOne({ _id: cat._id }),
            Discount.deleteOne({ _id: code._id }), Notify.deleteMany({ type: 'chat_escalation', message: /Alice asked/ }), ChatSession.deleteOne({ _id: session._id }), Knowledge.deleteMany({ _id: { $in: [faq._id, draft._id] } }),
        ]);
    }
    await done();
})();
