// Step 2.3: recommendation UI (home rows, no duplicates, product "You may also like", cart pairs, mobile, parallel loads)
const { chromium } = require('playwright');
const { model, URL, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [User, Cart, UserEvent] = ['user', 'cart', 'userEvent'].map(model);
    const b = await chromium.launch();
    const errs = [];
    const email = `rui${tag()}@x.com`;
    try {
        // guest, no history: Trending only
        const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errs.push(e.message));
        const recoStarts = [];
        const t0 = Date.now();
        page.on('request', (r) => /\/reco\/(trending|for-me)/.test(r.url()) && recoStarts.push(Date.now() - t0));
        await page.goto(URL.SHOP + '/');
        await page.waitForTimeout(2500);
        const body = await page.locator('main').innerText();
        check('guest home: "Trending Now" row shown', /Trending Now/.test(body));
        check('guest with no history: no "Recommended for You" row', !/Recommended for You/.test(body));
        check('home reco requests start together (not a waterfall)', recoStarts.length >= 2 && Math.max(...recoStarts) - Math.min(...recoStarts) < 150, JSON.stringify(recoStarts));
        const dishLinks = async () => (await page.locator('main .fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href'))));
        const hrefs = await dishLinks();
        check('no dish appears twice on the home page', new Set(hrefs).size === hrefs.length, `${hrefs.length} cards`);

        // build guest history: view three dishes from the trending row
        const trend = await page.locator('section:has(h2:text("Trending Now")) .fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
        for (const h of trend.slice(0, 3)) {
            await page.goto(URL.SHOP + h);
            await page.waitForTimeout(1200);
            const also = await page.locator('section:has(h2:text("You may also like")) .fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
            if (h === trend[0]) check('product page: "You may also like" never shows the same dish', also.length > 0 && !also.includes(h), `${also.length} shown`);
        }
        await new Promise((r) => setTimeout(r, 400));
        await page.goto(URL.SHOP + '/');
        await page.waitForTimeout(2500);
        check('guest with history: "Recommended for You" appears', /Recommended for You/.test(await page.locator('main').innerText()));
        const hrefs2 = await dishLinks();
        check('still no duplicates with both rows', new Set(hrefs2).size === hrefs2.length);

        // cart: goes well with
        const reg = await ctx.request.post(`${URL.API}/user/register`, { data: { name: 'Reco UI', email, password: 'Recoui123' } });
        check('signup ok', reg.status() === 201);
        const pid = trend[0].split('/').pop();
        await ctx.request.post(`${URL.API}/cart/add`, { data: { productId: pid, quantity: 1 } });
        await page.goto(URL.SHOP + '/cart');
        await page.waitForTimeout(2500);
        const pairs = await page.locator('.fk-pairs .fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
        check('cart: "Goes well with your order" shown, excludes the cart dish', pairs.length > 0 && !pairs.includes(trend[0]), `${pairs.length} shown`);
        if (process.argv[2]) await page.screenshot({ path: `${process.argv[2]}/cart-pairs.png`, fullPage: true });

        // mobile
        const m = await b.newPage({ viewport: { width: 360, height: 780 } });
        m.on('pageerror', (e) => errs.push(e.message));
        for (const p of ['/', trend[0], '/cart']) {
            await m.goto(URL.SHOP + p);
            await m.waitForTimeout(1500);
            check(`360px ${p === '/' ? 'home' : p === '/cart' ? 'cart' : 'product'}: no horizontal scroll`, !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
        }
        if (process.argv[2]) {
            await page.goto(URL.SHOP + '/');
            await page.waitForTimeout(2500);
            await page.locator('section:has(h2:text("Recommended for You"))').screenshot({ path: `${process.argv[2]}/home-foryou.png` });
        }
        check('no page errors', errs.length === 0, errs[0]);
    } finally {
        await b.close();
        const u = await User.findOne({ email });
        if (u) await Promise.all([Cart.deleteMany({ userId: u._id }), UserEvent.deleteMany({ userId: u._id }), User.deleteOne({ _id: u._id })]);
    }
    await done();
})();
