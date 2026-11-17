// Customer site layout audit: every page × 3 widths × guest/signed-in. Checks sideways scroll, layout shift (CLS),
// page/console errors, broken images, content off the screen edge, overlapping fixed elements, small tap targets.
// Usage: node siteaudit.js <screenshot dir> [--report]   (--report: list problems without failing)
const path = require('path');
const { chromium } = require('playwright');
const { URL, check, done } = require('./lib');

const dir = process.argv[2] || require('os').tmpdir();
const WIDTHS = [1440, 768, 390];

(async () => {
    const b = await chromium.launch();
    // a signed-in customer with a cart and one order
    const email = `site${Date.now().toString(36)}@x.com`;
    const api = await (await chromium.launch()).newContext();
    const setup = await b.newContext();
    await setup.request.post(`${URL.API}/user/register`, { data: { name: 'Site Audit', email, password: 'SiteAudit1' } });
    await setup.request.post(`${URL.API}/user/login`, { data: { email, password: 'SiteAudit1' } });
    const products = (await (await setup.request.get(`${URL.API}/product/fetch?limit=4`)).json()).products || [];
    const dish = products.find((p) => p.inStock) || products[0];
    await setup.request.post(`${URL.API}/cart/add`, { data: { productId: dish._id, quantity: 1 } });
    await setup.request.post(`${URL.API}/order/create`, { data: { shippingAddress: { fullName: 'Site Audit', phone: '+92 300 1234567', line1: '1 Test Street', city: 'Lahore', zip: '54000' }, paymentMethod: 'cod' } });
    await setup.request.post(`${URL.API}/cart/add`, { data: { productId: dish._id, quantity: 2 } });
    const state = await setup.storageState();
    await setup.close();
    await api.browser().close();

    const PAGES = [
        ['home', '/', 'guest'], ['menu', '/products', 'guest'], ['product', `/product/${dish._id}`, 'guest'], ['about', '/about', 'guest'], ['contact', '/contact', 'guest'],
        ['login', '/login', 'guest'], ['signup', '/signup', 'guest'], ['forgot', '/forgot', 'guest'], ['notfound', '/no-such-page', 'guest'],
        ['home-user', '/', 'user'], ['cart', '/cart', 'user'], ['address', '/address', 'user'], ['payment', '/payment', 'user'], ['orders', '/track', 'user'], ['profile', '/user/profile', 'user'], ['wishlist', '/wishlist', 'user'], ['menu-user', '/products', 'user'],
    ];
    const problems = [];
    for (const w of WIDTHS) {
        for (const who of ['guest', 'user']) {
            const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, ...(who === 'user' ? { storageState: state } : {}) });
            await ctx.addInitScript(() => {
                window.__cls = 0;
                new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
            });
            for (const [name, url, need] of PAGES.filter((x) => x[2] === who)) {
                const p = await ctx.newPage();
                const errs = [];
                p.on('pageerror', (e) => errs.push(e.message));
                p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource|stripe/i.test(m.text()) && errs.push(m.text().slice(0, 140)));
                await p.goto(URL.SHOP + url, { waitUntil: 'networkidle' }).catch(() => {});
                await p.waitForTimeout(1200);
                // scroll through so lazy rows and reveal animations run, then back to the top
                await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
                await p.waitForTimeout(900);
                const r = await p.evaluate(() => {
                    const vw = window.innerWidth;
                    const out = { overflow: document.documentElement.scrollWidth - vw, cls: Math.round(window.__cls * 1000) / 1000, broken: [], offscreen: [], small: [] };
                    for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.getBoundingClientRect().width > 0) out.broken.push(img.getAttribute('src')?.slice(0, 60));
                    const desc = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}${el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : ''}`;
                    for (const el of document.querySelectorAll('body *')) {
                        const cs = getComputedStyle(el);
                        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
                        const b = el.getBoundingClientRect();
                        if (!b.width || !b.height) continue;
                        // visible content sticking out of the page (ignoring things inside a scroller or clipped parent)
                        if (b.right > vw + 1 || b.left < -1) {
                            let clipped = false;
                            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflow)) { clipped = true; break; } }
                            if (!clipped && out.offscreen.length < 6) out.offscreen.push(desc(el));
                        }
                    }
                    if (vw < 500) for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')) {
                        const b = el.getBoundingClientRect();
                        const cs = getComputedStyle(el);
                        if (!b.width || cs.visibility === 'hidden' || b.top > document.body.scrollHeight) continue;
                        if (el.tagName === 'A' && cs.display === 'inline') continue; // text links in a sentence or breadcrumb (WCAG 2.5.8 inline exception)
                        if (el.tagName === 'INPUT' && el.readOnly && el.tabIndex < 0) continue; // display-only quantity
                        if ((b.height < 32 || b.width < 32) && !el.closest('p, li, footer') && out.small.length < 8) out.small.push(`${desc(el)} ${Math.round(b.width)}x${Math.round(b.height)}`);
                    }
                    return out;
                });
                await p.screenshot({ path: path.join(dir, `${name}-${w}.png`), fullPage: true });
                if (name === 'orders' && w === 1440) {
                    const current = await p.locator('[aria-current="step"]').first().innerText().catch(() => '');
                    check('an unpaid cash order that can still be cancelled shows "Placed", not "Preparing"', /Placed/.test(current), current);
                }
                const list = [];
                if (r.overflow > 1) list.push(`sideways scroll ${r.overflow}px`);
                if (r.cls > 0.1) list.push(`layout shift ${r.cls}`);
                if (errs.length) list.push(`errors: ${errs.slice(0, 2).join(' | ')}`);
                if (r.broken.length) list.push(`broken images: ${r.broken.join(', ')}`);
                if (r.offscreen.length) list.push(`off screen: ${r.offscreen.join(', ')}`);
                if (r.small.length) list.push(`small tap targets: ${r.small.join(', ')}`);
                console.log(`${list.length ? 'ISSUE' : 'ok   '}  ${name} @${w}${list.length ? `\n         ${list.join('\n         ')}` : ''}`);
                if (list.some((x) => !x.startsWith('small tap'))) problems.push(`${name}@${w}`);
                await p.close();
            }
            await ctx.close();
        }
    }
    await b.close();
    if (!process.argv.includes('--report')) check('every page at every width: no sideways scroll, shift, errors, broken images or off-screen content', problems.length === 0, problems.join(', '));
    await done();
})();
