// Step 4.1: chat widget (stream + cards, confirm/cancel, login prompt, history, keyboard, XSS, 429/503, lazy load, hidden pages, mobile)
const { chromium, request } = require('playwright');
const { model, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [User, Cart, Knowledge, ChatSession, ChatMessage] = ['user', 'cart', 'knowledge', 'chatSession', 'chatMessage'].map(model);
    const t = tag();
    const email = `cui${t}@x.com`;
    const faq = await Knowledge.create({ question: `Do you host karaoke nights ${t}?`, answer: `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script> Karaoke ${t} is every Friday.`, isActive: true });
    const b = await chromium.launch();
    const errs = [];
    const watch = (p) => {
        p.on('pageerror', (e) => errs.push(e.message));
        p.on('dialog', (d) => { errs.push(`dialog: ${d.message()}`); d.dismiss(); });
    };
    const panel = (p) => p.getByRole('dialog', { name: 'Cafe Fresco assistant' });
    const open = async (p) => {
        await p.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).click();
        await panel(p).waitFor();
    };
    const send = async (p, text) => {
        await p.getByLabel('Message').fill(text);
        await p.getByLabel('Message').press('Enter');
        await p.waitForFunction(() => !document.querySelector('.cc-send.is-stop'), null, { timeout: 15000 });
        await p.waitForTimeout(300);
    };
    try {
        // lazy panel + guest flow
        const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
        const p = await ctx.newPage();
        watch(p);
        const scripts = [];
        p.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
        await p.goto(URL.SHOP + '/');
        await p.waitForTimeout(1500);
        check('panel code not loaded before opening (lazy)', !scripts.some((s) => /ChatPanel/.test(s)));
        await open(p);
        check('panel loads on open', scripts.some((s) => /ChatPanel/.test(s)));
        check('greeting and suggestion chips shown', /Cafe Fresco assistant/.test(await panel(p).innerText()) && (await panel(p).getByRole('button', { name: "Today's deals" }).count()) === 1);
        await panel(p).getByRole('button', { name: "Today's deals" }).click();
        await p.waitForFunction(() => !document.querySelector('.cc-send.is-stop'), null, { timeout: 15000 });
        await p.waitForTimeout(400);
        check('deals answer streams in with dish cards', (await p.locator('.cc-dish').count()) > 0 && /\$\d/.test(await p.locator('.cc-msg.is-bot .cc-bubble').last().innerText()));
        check('feedback buttons appear after the answer', (await p.getByRole('button', { name: 'Helpful' }).count()) >= 1);
        await send(p, 'track my order');
        const login = p.locator('.cc-login').last();
        check('guest "track my order" → Log in button back to this page', (await login.count()) === 1 && (await login.getAttribute('href')) === '/login?next=%2F');
        await send(p, `do you host karaoke nights ${t}`);
        check('HTML in an answer is shown as text, never run', (await p.evaluate(() => window.__xss)) === undefined && (await p.locator('.cc-bubble img, .cc-bubble script').count()) === 0 && /karaoke/i.test(await p.locator('.cc-msg.is-bot').last().innerText()), (await p.locator('.cc-msg.is-bot').last().innerText()).slice(0, 200));

        // history survives a reload
        const before = await p.locator('.cc-msg.is-user').count();
        await p.reload();
        await p.waitForTimeout(1200);
        await open(p);
        await p.waitForTimeout(1200);
        check('history comes back after a reload', (await p.locator('.cc-msg.is-user').count()) === before);
        // keyboard: Esc closes and focus returns to the launcher
        await p.keyboard.press('Escape');
        await p.waitForTimeout(200);
        check('Esc closes and focus returns to the launcher', (await panel(p).count()) === 0 && (await p.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Open the Cafe Fresco assistant');
        await p.keyboard.press('Enter');
        await panel(p).waitFor();
        check('Enter on the launcher reopens it with the message box focused', (await p.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Message');
        await p.getByRole('button', { name: 'Start a new chat' }).click();
        await p.waitForTimeout(500);
        check('New chat clears the conversation', (await p.locator('.cc-msg.is-user').count()) === 0);

        // 429 and 503 messages
        await p.route('**/chat/message', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: '{"message":"slow down"}' }));
        await send(p, 'hello');
        check('429 → friendly "sending quickly" message', /sending messages quickly/.test(await p.locator('.cc-notice').innerText()));
        await p.unroute('**/chat/message');
        const ad = await request.newContext({ baseURL: URL.API });
        await ad.post('/admin/login', { data: ADMIN });
        const settings = await (await ad.get('/settings')).json();
        await ad.put('/settings', { data: { chatbot: { ...settings.chatbot, enabled: false } } });
        await send(p, 'hello');
        check('chat switched off → "taking a break" message', /taking a break/.test(await p.locator('.cc-notice').innerText()));
        await ad.put('/settings', { data: { chatbot: { ...settings.chatbot, enabled: true } } });

        // logged in: add via action card (Confirm) and Cancel
        const reg = await ctx.request.post(`${URL.API}/user/register`, { data: { name: 'Chat UI', email, password: 'Chatui123' } });
        check('signup ok', reg.status() === 201);
        await p.reload();
        await p.waitForTimeout(1500);
        await open(p);
        await send(p, 'add 2 honey butter pancakes');
        const card = p.locator('.cc-action').last();
        check('"add 2 …" → Confirm card; cart still empty', (await card.getByRole('button', { name: 'Confirm' }).count()) === 1 && !(await Cart.findOne({ userId: (await User.findOne({ email }))._id }))?.items?.length);
        await card.getByRole('button', { name: 'Confirm' }).click();
        await p.waitForTimeout(1500);
        const u = await User.findOne({ email });
        check('Confirm adds 2 to the cart and the card says Added', (await Cart.findOne({ userId: u._id }))?.items?.[0]?.quantity === 2 && /Added/.test(await card.innerText()));
        check('navbar cart badge updates', (await p.locator('nav.cf-nav .cf-count').allInnerTexts()).some((x) => x.trim() === '1'));
        await send(p, 'add 1 rainbow fruit bowl');
        await p.locator('.cc-action').last().getByRole('button', { name: 'Cancel' }).click();
        await p.waitForTimeout(800);
        check('Cancel adds nothing', (await Cart.findOne({ userId: u._id })).items.length === 1 && /Not added/.test(await p.locator('.cc-action').last().innerText()));

        // hidden on checkout pages
        await p.goto(URL.SHOP + '/address');
        await p.waitForTimeout(1200);
        check('launcher hidden on /address (checkout)', (await p.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).count()) === 0);

        // mobile
        const m = await b.newPage({ viewport: { width: 360, height: 760 } });
        watch(m);
        await m.goto(URL.SHOP + '/');
        await m.waitForTimeout(1500);
        const lb = await m.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).boundingBox();
        check('phone: round 56px launcher', Math.round(lb.width) === 56 && Math.round(lb.height) === 56);
        await open(m);
        const box = await panel(m).boundingBox();
        check('phone: chat is full screen, no horizontal scroll', Math.round(box.width) === 360 && Math.round(box.height) === 760 && !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
        await m.getByRole('button', { name: 'Recommend something' }).click();
        await m.waitForFunction(() => !document.querySelector('.cc-send.is-stop'), null, { timeout: 15000 });
        await m.waitForTimeout(500);
        if (process.argv[2]) await m.screenshot({ path: `${process.argv[2]}/chat-mobile.png` });
        const small = await m.locator('.cc-panel button').evaluateAll((els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 32).map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
        check('phone: buttons are at least 32px tall', small.length === 0, small.join(', '));
        check('no page errors or alerts', errs.length === 0, errs[0]);
    } finally {
        await b.close();
        const u = await User.findOne({ email });
        const s = await ChatSession.find(u ? { $or: [{ userId: u._id }] } : {}).select('_id').lean();
        if (u) {
            await ChatMessage.deleteMany({ sessionId: { $in: s.map((x) => x._id) } });
            await ChatSession.deleteMany({ userId: u._id });
            await Cart.deleteMany({ userId: u._id });
            await User.deleteOne({ _id: u._id });
        }
        await Knowledge.deleteOne({ _id: faq._id });
    }
    await done();
})();
