// Step 1.1: tags, dietary facts, allergens (validation, partial updates, tags endpoint, shop + dashboard round trip)
const { request, chromium } = require('playwright');
const { model, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Product, Category, Inventory] = ['product', 'category', 'inventory'].map(model);
    const t = tag();
    const cat = await Category.create({ title: `Tag Cat ${t}` });
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const base = { title: `Tag Dish ${t}`, description: 'A test dish', price: '9', category: String(cat._id), stock: '3' };
    let id;
    try {
        const add = await ad.post('/product/add', { multipart: { ...base, tags: JSON.stringify(['Cheesy', 'cheesy ', 'Grilled']), dietary: JSON.stringify({ vegetarian: 'true', vegan: 'unknown', spicyLevel: 2 }), allergens: JSON.stringify(['dairy']), allergensVerified: 'false' } });
        const body = await add.json();
        id = body.product?._id;
        check('add with food facts → 201', add.status() === 201, body.message);
        const p = await Product.findById(id).lean();
        check('tags lower-cased and de-duplicated', JSON.stringify(p.tags) === JSON.stringify(['cheesy', 'grilled']));
        check('dietary stored (unknown stays null)', p.dietary.vegetarian === true && p.dietary.vegan === null && p.dietary.spicyLevel === 2);
        check('allergens stored, not verified', p.allergens[0] === 'dairy' && p.allergensVerified === false);

        const bad = async (field, value) => (await ad.put(`/product/update/${id}`, { multipart: { [field]: value } })).status();
        check('11 tags → 400', (await bad('tags', JSON.stringify(Array.from({ length: 11 }, (_, i) => `tag${i}`)))) === 400);
        check('tag with symbols → 400', (await bad('tags', JSON.stringify(['<script>']))) === 400);
        check('not a list → 400', (await bad('tags', 'cheesy')) === 400);
        check('unknown allergen → 400', (await bad('allergens', JSON.stringify(['chalk']))) === 400);
        check('spice 5 → 400', (await bad('dietary', JSON.stringify({ vegetarian: null, vegan: null, spicyLevel: 5 }))) === 400);
        check('vegan but not vegetarian → 400', (await bad('dietary', JSON.stringify({ vegetarian: false, vegan: true, spicyLevel: null }))) === 400);

        const upd = await ad.put(`/product/update/${id}`, { multipart: { price: '10' } });
        check('editing the price keeps tags/dietary/allergens', upd.status() === 200 && (await Product.findById(id).lean()).tags.length === 2);

        await Inventory.updateOne({ productId: id }, { quantityInStock: 3 });
        const tags = await (await ad.get('/product/tags')).json();
        check('/product/tags counts this product', tags.tags.some((x) => x.tag === 'cheesy' && x.count >= 1) && tags.allergens.includes('sesame'));
        await Product.updateOne({ _id: id }, { isActive: false });
        const before = tags.tags.find((x) => x.tag === 'cheesy').count;
        const after = (await (await ad.get('/product/tags')).json()).tags.find((x) => x.tag === 'cheesy')?.count || 0;
        check('inactive products are not counted', after === before - 1);
        await Product.updateOne({ _id: id }, { isActive: true });

        // shop: badges + unverified allergen note
        const b = await chromium.launch();
        const page = await b.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(e.message));
        await page.goto(`${URL.SHOP}/product/${id}`);
        await page.waitForTimeout(1500);
        let text = await page.locator('.fd-info').innerText();
        check('shop shows Vegetarian + Medium + #tags', /Vegetarian/.test(text) && /Medium/.test(text) && /#cheesy/.test(text));
        check('unverified allergens are NOT shown', !/Contains: dairy/.test(text) && /ask our staff/i.test(text));
        check('no invented delivery time when none is set', !/Delivered in/.test(text) || /Delivered in about \d+ mins/.test(text));
        await ad.put(`/product/update/${id}`, { multipart: { allergensVerified: 'true' } }); // like the dashboard: clears the catalogue cache
        await page.reload();
        await page.waitForTimeout(1500);
        text = await page.locator('.fd-info').innerText();
        check('verified allergens are shown', /Contains: dairy/.test(text));

        // dashboard edit page loads the values and saves without touching them
        const dctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
        await dctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const d = await dctx.newPage();
        d.on('pageerror', (e) => errs.push(e.message));
        await d.goto(`${URL.DASH}/admin/edit-product/${id}`);
        await d.waitForTimeout(2500);
        check('dashboard shows the tag chips', (await d.locator('.MuiChip-root', { hasText: 'cheesy' }).count()) === 1);
        await d.getByLabel('Tags').fill('kids');
        await d.getByLabel('Tags').press('Enter');
        check('Enter in the tag box adds a chip, does not submit', (await d.locator('.MuiChip-root', { hasText: 'kids' }).count()) === 1 && !(await Product.findById(id).lean()).tags.includes('kids'));
        await d.getByRole('button', { name: 'Update Product' }).click();
        await d.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
        await d.waitForTimeout(2000);
        const saved = await Product.findById(id).lean();
        check('dashboard adds a tag and keeps dietary/allergens', saved.tags.includes('kids') && saved.dietary.vegetarian === true && saved.allergensVerified === true, JSON.stringify(saved.tags));
        if (process.argv[2]) await d.screenshot({ path: `${process.argv[2]}/edit-food.png`, fullPage: true });
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();
    } finally {
        if (id) await Promise.all([Product.deleteOne({ _id: id }), Inventory.deleteMany({ productId: id })]);
        await Category.deleteOne({ _id: cat._id });
    }
    await done();
})();
