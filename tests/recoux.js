// Recommendation UX walk-through (live shop): home rows, "why" reasons, product page, cart, phone size. Usage: node recoux.js <dir>
const path = require('path');
const { chromium } = require('playwright');
const { URL, check, done } = require('./lib');

(async () => {
    const dir = process.argv[2] || require('os').tmpdir();
    const b = await chromium.launch();
    const errs = [];
    try {
        for (const w of [1440, 390]) {
            const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 } });
            // a signed-in customer (the cart page asks guests to sign in)
            const email = `recoux${Date.now().toString(36)}${w}@x.com`;
            await ctx.request.post(`${URL.API}/user/register`, { data: { name: 'Reco Tester', email, password: 'Recoux123' } });
            await ctx.request.post(`${URL.API}/user/login`, { data: { email, password: 'Recoux123' } });
            const p = await ctx.newPage();
            p.on('pageerror', (e) => errs.push(`${w}: ${e.message}`));
            p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errs.push(`${w}: ${m.text()}`));
            const shot = async (n) => { await p.waitForTimeout(900); return p.screenshot({ path: path.join(dir, `reco-${n}-${w}.png`), fullPage: false }); };
            const row = (title) => p.locator(`section:has(h2:text("${title}"))`);
            const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

            await p.goto(URL.SHOP + '/');
            await p.waitForTimeout(2500);
            await row('Trending Now').scrollIntoViewIfNeeded();
            await shot('home-guest');
            check(`${w}: Trending Now shown with dishes`, (await row('Trending Now').locator('.fh-dish-body').count()) >= 4);
            check(`${w}: home has no sideways scroll`, (await overflow()) <= 1, `${await overflow()}px`);

            const links = await row('Trending Now').locator('.fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
            for (const h of links.slice(0, 3)) {
                await p.goto(URL.SHOP + h);
                await p.waitForTimeout(1300);
            }
            await row('You may also like').scrollIntoViewIfNeeded().catch(() => {});
            await shot('product');
            const also = await row('You may also like').locator('.fh-dish-body').count();
            check(`${w}: product page shows "You may also like"`, also >= 2, `${also} dishes`);
            check(`${w}: product page has no sideways scroll`, (await overflow()) <= 1);

            // add the dish to the cart, then the cart pairing row
            const add = p.getByRole('button', { name: /add to cart/i }).first();
            if (await add.count()) await add.click();
            await p.waitForTimeout(1200);
            await p.goto(URL.SHOP + '/cart');
            await p.waitForTimeout(2500);
            await row('Goes well with your order').scrollIntoViewIfNeeded().catch(() => {});
            await shot('cart');
            check(`${w}: cart shows "Goes well with your order"`, (await row('Goes well with your order').locator('.fh-dish-body, a, button').count()) > 0);
            check(`${w}: cart has no sideways scroll`, (await overflow()) <= 1);

            await p.goto(URL.SHOP + '/');
            await p.waitForTimeout(3000);
            const mine = row('Recommended for You');
            await mine.scrollIntoViewIfNeeded().catch(() => {});
            await shot('home-history');
            check(`${w}: after viewing dishes, "Recommended for You" appears`, (await mine.count()) === 1 && (await mine.locator('.fh-dish-body').count()) >= 2);
            const why = await mine.innerText().catch(() => '');
            check(`${w}: each pick explains why`, /because you like|similar|viewed|like|love|fan of/i.test(why) && !/brighten your day/i.test(why), why.replace(/\n/g, ' ').slice(0, 160));
            const mineIds = await mine.locator('.fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
            const trendIds = await row('Trending Now').locator('.fh-dish-body').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
            const same = mineIds.length && mineIds.every((x, i) => x === trendIds[i]);
            check(`${w}: "Recommended for You" is not a copy of Trending`, !same);
            await ctx.close();
        }
        check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    } finally {
        await b.close();
    }
    await done();
})();
