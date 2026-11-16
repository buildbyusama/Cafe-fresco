// Step 1.2: price / tag / diet filters (API on the final price, URL round-trip, chips, reset, mobile sheet)
const { request, chromium } = require('playwright');
const { model, URL, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory] = ['product', 'category', 'inventory'].map(model);
    const t = tag();
    const cat = await Category.create({ title: `Filter Cat ${t}` });
    const mk = (title, price, discount, extra = {}) => Product.create({ title: `${title} ${t}`, description: 'filter test', price, discount, category: cat._id, ...extra });
    // $10 with 50% off = $5.00 (matches max=5 only on the FINAL price)
    const half = await mk('Half Price', 10, 50, { tags: ['cheesy', 'kids'], dietary: { vegetarian: true, vegan: null, spicyLevel: null } });
    const cheap = await mk('Cheap', 3, 0, { tags: ['cheesy'], dietary: { vegetarian: true, vegan: true, spicyLevel: 0 } });
    const pricey = await mk('Pricey', 20, 0, { tags: ['grilled'] });
    await Inventory.create([half, cheap, pricey].map((p) => ({ productId: p._id, quantityInStock: 5 })));
    const api = await request.newContext({ baseURL: URL.API });
    const ids = async (qs) => ((await (await api.get(`/product/fetch?category=${cat._id}&${qs}`)).json()).products || []).map((p) => p.title.replace(` ${t}`, '')).sort().join(',');
    try {
        check('maxPrice uses the final price ($10 −50% = $5 matches max=5)', (await ids('maxPrice=5')) === 'Cheap,Half Price');
        check('minPrice', (await ids('minPrice=5')) === 'Half Price,Pricey');
        check('range', (await ids('minPrice=4&maxPrice=6')) === 'Half Price');
        check('tags AND', (await ids('tags=cheesy,kids')) === 'Half Price');
        check('tags case-insensitive', (await ids('tags=CHEESY')) === 'Cheap,Half Price');
        check('diet=vegetarian', (await ids('diet=vegetarian')) === 'Cheap,Half Price');
        check('diet=vegan', (await ids('diet=vegan')) === 'Cheap');
        check('combined with sort=low', (await (await api.get(`/product/fetch?category=${cat._id}&tags=cheesy&sort=low`)).json()).products?.[0]?.title.startsWith('Cheap'));
        const totalRes = await (await api.get(`/product/fetch?category=${cat._id}&maxPrice=5&limit=1`)).json();
        check('total counts the filtered set (2) across pages', totalRes.total === 2 && totalRes.totalPages === 2);
        check('min > max → 400', (await api.get('/product/fetch?minPrice=9&maxPrice=2')).status() === 400);
        check('negative price → 400', (await api.get('/product/fetch?minPrice=-1')).status() === 400);
        check('bad diet → 400', (await api.get('/product/fetch?diet=keto')).status() === 400);

        const b = await chromium.launch();
        const errs = [];
        const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
        p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(`${URL.SHOP}/products?category=${cat._id}&page=2`);
        await p.waitForTimeout(1500);
        await p.getByRole('button', { name: /Filters/ }).click();
        await p.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'Under $5' }).click();
        await p.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: /#cheesy/ }).click();
        await p.getByRole('button', { name: 'Show results' }).click();
        await p.waitForTimeout(1500);
        const u = new globalThis.URL(p.url());
        check('apply writes max/tags to the URL and resets the page', u.searchParams.get('max') === '5' && u.searchParams.get('tags') === 'cheesy' && !u.searchParams.has('page'));
        const titles = await p.locator('.fh-dish-body b').allInnerTexts();
        check('grid shows only matching dishes', titles.length === 2 && titles.every((x) => /Cheap|Half Price/.test(x)), titles.join(' | '));
        check('active chips + count badge', (await p.locator('.fm-active .fm-pill').count()) === 2 && (await p.locator('.fm-filter-n').innerText()) === '2');
        await p.reload();
        await p.waitForTimeout(1500);
        check('reload keeps the filters', (await p.locator('.fh-dish-body b').count()) === 2);
        await p.getByRole('button', { name: 'Remove filter #cheesy' }).click();
        await p.waitForTimeout(1200);
        check('removing a chip updates URL and grid', !new globalThis.URL(p.url()).searchParams.has('tags') && (await p.locator('.fh-dish-body b').count()) === 2);
        await p.getByRole('button', { name: /Filters/ }).click();
        await p.getByLabel('Minimum price').fill('9');
        await p.getByLabel('Maximum price').fill('2');
        await p.getByRole('button', { name: 'Show results' }).click();
        check('min above max is caught in the panel', (await p.getByRole('alert').innerText()).includes('above'));
        await p.keyboard.press('Escape');
        check('Escape closes the panel', (await p.getByRole('dialog', { name: 'Filters' }).count()) === 0);
        await p.goto(`${URL.SHOP}/products?category=${cat._id}&min=100`);
        await p.waitForTimeout(1500);
        check('no results → empty state with a way out', /No products found/.test(await p.locator('body').innerText()));
        await p.getByRole('button', { name: /Clear filters/ }).first().click();
        await p.waitForTimeout(1200);
        check('Clear filters removes price/diet/tags', !/[?&](min|max|tags|diet)=/.test(p.url()));

        const m = await b.newPage({ viewport: { width: 360, height: 760 } });
        m.on('pageerror', (e) => errs.push(e.message));
        await m.goto(`${URL.SHOP}/products`);
        await m.waitForTimeout(1500);
        await m.getByRole('button', { name: /Filters/ }).click();
        await m.waitForTimeout(400);
        const box = await m.getByRole('dialog', { name: 'Filters' }).boundingBox();
        check('phone: bottom sheet, full width, no horizontal scroll', Math.round(box.width) === 360 && Math.round(box.y + box.height) === 760 && !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
        if (process.argv[2]) await m.screenshot({ path: `${process.argv[2]}/filters-mobile.png` });
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();
    } finally {
        await Inventory.deleteMany({ productId: { $in: [half._id, cheap._id, pricey._id] } });
        await Product.deleteMany({ _id: { $in: [half._id, cheap._id, pricey._id] } });
        await Category.deleteOne({ _id: cat._id });
    }
    await done();
})();
