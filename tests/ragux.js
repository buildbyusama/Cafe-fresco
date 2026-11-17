// RAG R5.3 audit pass 3 (UX): screenshots of every document surface for review. Usage: node ragux.js <dir>
const path = require('path');
const { chromium } = require('playwright');
const { model, bcrypt, backend, URL, check, connect, done, tag } = require('./lib');

(async () => {
    await connect();
    const [Admin, Document, DocChunk] = ['admin', 'document', 'docChunk'].map(model);
    const { ingest } = backend('services/rag/ingest');
    const { changed } = backend('services/rag/documents');
    const t = tag();
    const dir = process.argv[2] || require('os').tmpdir();
    const mgr = await Admin.create({ name: 'UX Manager', email: `ux${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'manager' });
    const made = [];
    const add = async (title, text, publish, i) => {
        const d = await Document.create({ title, mime: 'text/markdown', sha256: `${t}-ux-${i}` });
        made.push(d._id);
        await ingest(d._id, Buffer.from(text), 'x.md');
        if (publish) await Document.updateOne({ _id: d._id }, { isPublished: true });
    };
    await add('Catering and Events Guide', '# Weddings\n\nWe cater weddings for 50 to 400 guests. Book at least fourteen days ahead; a thirty percent deposit confirms the date.\n\n# Birthday parties\n\nThe party hall seats 40 children and needs two days notice.', true, 1);
    await add('House Policies', '# Parking\n\nFree parking for 30 cars is behind the building. Valet parking on Friday and Saturday evenings.\n\n# Halal\n\nAll our meat is halal certified.', false, 2);
    await add('Staff contacts (draft)', '# Staff\n\nCall Ali at 0300-1234567 or email ali@example.com about supplier invoices and the weekly rota for the kitchen team.', false, 3);
    await add('Scanned flyer', '', false, 4);
    changed();
    const b = await chromium.launch();
    const errs = [];
    const page = async (width, colorScheme = 'light') => {
        const ctx = await b.newContext({ viewport: { width, height: width < 500 ? 780 : 900 }, colorScheme });
        await ctx.request.post(`${URL.API}/admin/login`, { data: { email: mgr.email, password: 'Pass1234' } });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errs.push(e.message));
        p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errs.push(m.text()));
        return p;
    };
    const shot = (p, name, full = true) => p.screenshot({ path: path.join(dir, `${name}.png`), fullPage: full });
    try {
        for (const w of [1440, 768, 360]) {
            const p = await page(w);
            await p.goto(`${URL.DASH}/admin/ai-documents`);
            await p.getByText('Catering and Events Guide').first().waitFor({ timeout: 15000 });
            await p.waitForTimeout(800);
            await shot(p, `ux-docs-${w}`);
            const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            check(`documents page at ${w}px: no sideways page scroll`, overflow <= 1, `${overflow}px`);
            // every publish switch and delete button is on screen (no hidden sideways-scrolling table)
            const offscreen = await p.evaluate(() => [...document.querySelectorAll('[data-testid="doc-row"] input[type="checkbox"], [data-testid="doc-row"] button[aria-label^="Delete"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > window.innerWidth || r.left < 0; }).length);
            check(`documents page at ${w}px: every control visible`, offscreen === 0, `${offscreen} off screen`);
            const summary = await p.getByText(/of 50 documents/).first().evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
            check(`documents page at ${w}px: library usage line not cut off`, summary);
            if (w === 1440) {
                const box = p.getByRole('textbox', { name: /question/i }).first();
                await box.fill('How far ahead should I book a wedding?');
                await p.getByRole('button', { name: /^(test|search|ask)/i }).first().click();
                await p.waitForTimeout(2500);
                await shot(p, 'ux-docs-test-1440');
                check('test box shows a plain match label, not a raw score', /Strong match|Good match|Weak match/.test(await p.locator('[data-testid="test-results"]').innerText()));
                const row = p.locator('[data-testid="doc-row"]', { hasText: 'Staff contacts' });
                await row.getByRole('button', { name: /publish/i }).first().click().catch(() => row.getByRole('checkbox').first().click());
                await p.waitForTimeout(1200);
                await shot(p, 'ux-docs-privacy-1440', false);
                const dlg = await p.getByRole('dialog').innerText().catch(() => '');
                check('privacy confirm: singular wording and a warning (not delete) style', /1 email address,/.test(dlg) && /1 phone number\./.test(dlg) && (await p.getByRole('dialog').locator('.MuiButton-containedWarning').count()) === 1, dlg.replace(/\n/g, ' ').slice(0, 160));
                await p.keyboard.press('Escape');
            }
            await p.context().close();
        }
        const dark = await page(1440, 'dark');
        await dark.goto(`${URL.DASH}/admin/ai-documents`);
        await dark.getByText('Catering and Events Guide').first().waitFor({ timeout: 15000 });
        await shot(dark, 'ux-docs-dark-1440');
        await dark.goto(`${URL.DASH}/admin/ai-insights`);
        await dark.waitForTimeout(3000);
        await dark.context().close();
        const ins = await page(1440);
        await ins.goto(`${URL.DASH}/admin/ai-insights`);
        await ins.waitForTimeout(3500);
        await shot(ins, 'ux-insights-1440');
        const insText = await ins.locator('main').innerText();
        check('insights: no raw tool names, correct plural', !/search_documents|search_knowledge/.test(insText) && !/\b1 messages\b/.test(insText));
        await ins.context().close();

        // shop chat with a document answer (real model when a key is set)
        for (const w of [1440, 360]) {
            const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 780 : 900 } });
            const p = await ctx.newPage();
            p.on('pageerror', (e) => errs.push(e.message));
            await p.goto(URL.SHOP + '/');
            await p.locator('.cc-launcher').click();
            await p.locator('.cc-compose textarea').waitFor();
            await p.locator('.cc-compose textarea').fill('How many days ahead should I book wedding catering?');
            await p.keyboard.press('Enter');
            await p.locator('.cc-source').first().waitFor({ timeout: 30000 }).catch(() => {});
            await p.waitForFunction(() => !document.querySelector('.cc-send.is-stop'), null, { timeout: 30000 }).catch(() => {});
            await p.waitForTimeout(600);
            await shot(p, `ux-chat-${w}`, false);
            check(`chat at ${w}px: source chip shown`, (await p.locator('.cc-source').count()) > 0);
            await ctx.close();
        }
        check('no page errors on any surface', errs.length === 0, errs.slice(0, 3).join(' | '));
    } finally {
        await b.close();
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
        await Admin.deleteOne({ _id: mgr._id });
        changed();
        backend('services/rag/retrieve').bust();
    }
    await done();
})();
