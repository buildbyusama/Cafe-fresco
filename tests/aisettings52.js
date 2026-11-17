// Step 5.2: assistant settings + knowledge pages (roles, switch-off reaches the shop, budget rules, re-index, FAQ CRUD in the UI)
const { request, chromium } = require('playwright');
const { model, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Admin, Knowledge] = ['admin', 'knowledge'].map(model);
    const t = tag();
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const original = await (await ad.get('/settings')).json();
    const [mgr, ed] = await Admin.create([
        { name: 'AI Mgr', email: `aim${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'manager' },
        { name: 'AI Ed2', email: `aie2${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' },
    ]);
    const b = await chromium.launch();
    const errs = [];
    const page = async (who) => {
        const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: who });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errs.push(e.message));
        return p;
    };
    try {
        // roles
        const mp = await page({ email: mgr.email, password: 'Pass1234' });
        await mp.goto(`${URL.DASH}/admin/ai-knowledge`);
        await mp.getByText('Test a question').waitFor({ timeout: 15000 }).catch(() => {});
        check('manager can open Knowledge', (await mp.getByText('Test a question').count()) === 1);
        check('manager has no Assistant settings link', (await mp.locator('a[href="/admin/ai-settings"]').count()) === 0);
        await mp.goto(`${URL.DASH}/admin/ai-settings`);
        await mp.waitForTimeout(2000);
        check('manager is denied Assistant settings', (await mp.getByText('Daily AI budget').count()) === 0);
        const ep = await page({ email: ed.email, password: 'Pass1234' });
        await ep.goto(`${URL.DASH}/admin/ai-knowledge`);
        await ep.waitForTimeout(2000);
        check('editor is denied Knowledge', (await ep.getByText('Test a question').count()) === 0);

        // settings page
        const p = await page(ADMIN);
        await p.goto(`${URL.DASH}/admin/ai-settings`);
        await p.waitForTimeout(2500);
        check('settings page shows status, budget and re-index', /rule-based answers only|AI on|Test mode/.test(await p.locator('main').innerText()) && (await p.getByText('Smart search index').count()) === 1);
        await p.getByLabel('Tokens per day').fill('99999999999');
        await p.getByRole('button', { name: 'Save' }).click();
        await p.waitForTimeout(1200);
        check('budget above the server limit is rejected', /Budget must be/.test(await p.locator('main').innerText()));
        await p.getByLabel('Tokens per day').fill('50000');
        await p.getByRole('button', { name: 'Save' }).click();
        await p.waitForTimeout(1500);
        const usage = await (await ad.get('/chat/admin/usage')).json();
        check('a lower budget is saved and applied', usage.budget === 50000, String(usage.budget));
        await p.getByRole('button', { name: 'Re-index menu and FAQ' }).click();
        await p.waitForTimeout(1500);
        const mainText = await p.locator('main').innerText();
        // with a key the re-index runs; without one it explains what to do
        check(process.env.OPENAI_API_KEY ? 're-index with a key reports the result' : 're-index without a key explains what to do', process.env.OPENAI_API_KEY ? /re-?index|updated|unchanged/i.test(mainText) : /OpenAI API key/.test(mainText), mainText.slice(0, 160));
        // switch the assistant off → the shop button disappears
        await p.getByRole('checkbox', { name: /Show the assistant/ }).uncheck();
        await p.getByRole('button', { name: 'Save' }).click();
        await p.waitForTimeout(1500);
        const shop = await b.newPage();
        await shop.goto(URL.SHOP + '/');
        await shop.waitForTimeout(2000);
        check('switched off → no chat button in the shop', (await shop.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).count()) === 0);
        await p.getByRole('checkbox', { name: /Show the assistant/ }).check();
        await p.getByRole('button', { name: 'Save' }).click();
        await p.waitForTimeout(1500);
        // /settings/public may be cached by a browser for up to 60 s; a new visitor sees it at once
        const fresh = await b.newPage();
        await fresh.goto(URL.SHOP + '/');
        await fresh.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).waitFor({ timeout: 10000 }).catch(() => {});
        check('switched on → chat button back', (await fresh.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).count()) === 1);
        if (process.argv[2]) await p.screenshot({ path: `${process.argv[2]}/ai-settings.png`, fullPage: true });

        // knowledge page: prefill from Insights, add, test, publish toggle, delete
        await p.goto(`${URL.DASH}/admin/ai-knowledge?new=${encodeURIComponent(`Do you have vegan cake ${t}?`)}`);
        await p.waitForTimeout(2000);
        const dialog = p.getByRole('dialog');
        check('?new= opens the add dialog with the question filled in', (await dialog.getByLabel('Question').inputValue()) === `Do you have vegan cake ${t}?`);
        await dialog.getByLabel('Answer').fill(`Yes: the vegan cake ${t} is baked every Saturday.`);
        await dialog.getByRole('button', { name: 'Save' }).click();
        await p.waitForTimeout(1500);
        const entry = await Knowledge.findOne({ question: `Do you have vegan cake ${t}?` });
        check('saved and published', entry?.isActive === true);
        await p.getByPlaceholder('e.g. Do you have parking?').fill(`vegan cake ${t}`);
        await p.getByRole('button', { name: 'Test' }).click();
        await p.waitForTimeout(1200);
        check('"Test a question" shows which entry would be used', /would use/.test(await p.locator('main').innerText()));
        await p.getByPlaceholder('Search').fill(`vegan cake ${t}`);
        await p.waitForTimeout(1200);
        await p.getByRole('checkbox', { name: `Published: Do you have vegan cake ${t}?` }).click();
        await p.waitForTimeout(1200);
        check('toggle moves it to drafts', (await Knowledge.findById(entry._id)).isActive === false);
        await p.getByRole('button', { name: `Delete Do you have vegan cake ${t}?` }).click();
        await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
        await p.waitForTimeout(1200);
        check('delete with confirmation', !(await Knowledge.findById(entry._id)));
        if (process.argv[2]) {
            await p.getByPlaceholder('Search').fill('');
            await p.waitForTimeout(1200);
            await p.screenshot({ path: `${process.argv[2]}/ai-knowledge.png`, fullPage: true });
        }
        check('no page errors', errs.length === 0, errs[0]);
    } finally {
        await b.close();
        await ad.put('/settings', { data: { chatbot: { ...original.chatbot } } });
        await Admin.deleteMany({ _id: { $in: [mgr._id, ed._id] } });
        await Knowledge.deleteMany({ question: new RegExp(t) });
    }
    await done();
})();
