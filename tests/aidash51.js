// Step 5.1: AI insights (roles, numbers match seeded data, privacy in transcripts, filters, page UI)
const { request, chromium } = require('playwright');
const { model, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [ChatSession, ChatMessage, User, Admin] = ['chatSession', 'chatMessage', 'user', 'admin'].map(model);
    const t = tag();
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const stats = async () => (await ad.get('/chat/admin/stats?range=7d')).json();
    const base = await stats();
    const u = await User.create({ name: 'Zara Insight', email: `zara${t}@x.com`, phone: '+92 300 9998887', password: 'x' });
    const now = Date.now();
    const s1 = await ChatSession.create({ userId: u._id, messageCount: 4, escalated: true, startedAt: new Date(now - 3600e3), lastAt: new Date(now - 3500e3) });
    const s2 = await ChatSession.create({ anonId: 'z'.repeat(32), messageCount: 2, startedAt: new Date(now - 7200e3), lastAt: new Date(now - 7100e3) });
    const q = `where is my parking spot ${t}`;
    await ChatMessage.insertMany([
        { sessionId: s1._id, role: 'user', content: q, at: new Date(now - 3600e3) },
        { sessionId: s1._id, role: 'tool', toolName: 'search_knowledge', toolArgs: { query: q }, at: new Date(now - 3599e3) },
        { sessionId: s1._id, role: 'assistant', content: "I don't know that yet.", unanswered: true, feedback: 'down', feedbackNote: 'useless', source: 'ai', latencyMs: 1200, at: new Date(now - 3598e3) },
        { sessionId: s1._id, role: 'user', content: q, at: new Date(now - 3550e3) },
        { sessionId: s1._id, role: 'assistant', content: 'Here you go: Zara, email zara@x.com', source: 'fallback', latencyMs: 800, at: new Date(now - 3549e3) },
        { sessionId: s2._id, role: 'user', content: q, at: new Date(now - 7200e3) },
        { sessionId: s2._id, role: 'assistant', content: 'Answer', feedback: 'up', source: 'ai', latencyMs: 1000, at: new Date(now - 7199e3) },
    ]);
    const ed = await Admin.create({ name: 'AI Ed', email: `aie${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' });
    try {
        const e = await request.newContext({ baseURL: URL.API });
        await e.post('/admin/login', { data: { email: ed.email, password: 'Pass1234' } });
        check('editor → 403 on stats and transcripts', (await e.get('/chat/admin/stats')).status() === 403 && (await e.get('/chat/admin/sessions')).status() === 403);
        check('customer → 401 on admin chat routes', (await (await request.newContext({ baseURL: URL.API })).get('/chat/admin/stats')).status() === 401);

        const s = await stats();
        const d = (k) => s[k] - base[k];
        check('conversations +2, questions +3', d('sessions') === 2 && d('messages') === 3, `${d('sessions')} / ${d('messages')}`);
        check('helpful +1, not helpful +1, unanswered +1, escalations +1', d('thumbsUp') === 1 && d('thumbsDown') === 1 && d('unanswered') === 1 && d('escalations') === 1);
        check('top questions include the repeated one (3 times)', s.topQuestions.some((x) => x.question === q && x.count >= 3));
        check('unanswered list shows the customer question', s.unansweredList.some((x) => x.question === q && x.sessionId === String(s1._id)));
        check('tool usage counted', s.tools.some((x) => x.tool === 'search_knowledge'));
        check('7 days of per-day counts', s.perDay.length === 7 && s.perDay.at(-1).messages >= 3);
        check('30-day range works', (await (await ad.get('/chat/admin/stats?range=30d')).json()).perDay.length === 30);

        const list = await (await ad.get('/chat/admin/sessions?filter=escalated')).json();
        const row = list.sessions.find((x) => x.id === String(s1._id));
        check('escalated filter + first name only', row && row.customer === 'Zara' && row.escalated);
        check('thumbs-down filter finds it', (await (await ad.get('/chat/admin/sessions?filter=thumbs-down')).json()).sessions.some((x) => x.id === String(s1._id)));
        check('guest shown as "Guest"', (await (await ad.get('/chat/admin/sessions')).json()).sessions.some((x) => x.id === String(s2._id) && x.customer === 'Guest'));
        const tr = await (await ad.get(`/chat/admin/sessions/${s1._id}`)).json();
        const trText = JSON.stringify({ customer: tr.customer, ...tr, messages: tr.messages.filter((m) => m.role !== 'assistant') });
        check('transcript: no customer email or phone from the account', !trText.includes(`zara${t}@x.com`) && !trText.includes('9998887') && tr.customer === 'Zara');
        check('transcript includes tool lookups and feedback notes', tr.messages.some((m) => m.role === 'tool' && /search_knowledge/.test(m.content)) && tr.messages.some((m) => m.feedbackNote === 'useless'));
        check('pagination shape', typeof list.totalPages === 'number' && list.page === 1);

        // page
        const b = await chromium.launch();
        const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (x) => errs.push(x.message));
        await p.goto(`${URL.DASH}/admin/ai-insights`);
        await p.waitForTimeout(3000);
        check('page shows KPI tiles and the chart', (await p.getByText('Conversations').count()) >= 1 && (await p.locator('.apexcharts-canvas').count()) >= 1);
        check('menu has AI Assistant → Insights', (await p.getByText('Insights', { exact: true }).count()) >= 1);
        await p.locator('tr', { hasText: 'Zara' }).first().getByRole('button', { name: 'Read' }).click();
        await p.waitForTimeout(1200);
        check('transcript drawer opens', /Chat with Zara/.test(await p.locator('.MuiDrawer-paperAnchorRight').innerText()));
        await p.keyboard.press('Escape');
        await p.waitForTimeout(300);
        await p.getByRole('button', { name: 'Create FAQ' }).first().click();
        await p.waitForTimeout(800);
        check('"Create FAQ" opens the knowledge page with the question prefilled', /\/admin\/ai-knowledge\?new=/.test(p.url()));
        if (process.argv[2]) {
            await p.goto(`${URL.DASH}/admin/ai-insights`);
            await p.waitForTimeout(3000);
            await p.screenshot({ path: `${process.argv[2]}/ai-insights.png`, fullPage: true });
        }
        const ectx = await b.newContext();
        await ectx.request.post(`${URL.API}/admin/login`, { data: { email: ed.email, password: 'Pass1234' } });
        const ep = await ectx.newPage();
        await ep.goto(`${URL.DASH}/admin/ai-insights`);
        await ep.waitForTimeout(2500);
        check('editor: no AI Insights link and page denied', (await ep.locator('a[href="/admin/ai-insights"]').count()) === 0 && (await ep.getByText('Conversations').count()) === 0);
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();
    } finally {
        await ChatMessage.deleteMany({ sessionId: { $in: [s1._id, s2._id] } });
        await ChatSession.deleteMany({ _id: { $in: [s1._id, s2._id] } });
        await User.deleteOne({ _id: u._id });
        await Admin.deleteOne({ _id: ed._id });
    }
    await done();
})();
