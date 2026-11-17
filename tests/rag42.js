// RAG R4.2: Insights for documents (lookups, top sources, gaps with Upload / Create FAQ actions)
const { chromium, request } = require('playwright');
const { model, URL, ADMIN, check, connect, done, tag } = require('./lib');

(async () => {
    await connect();
    const [ChatSession, ChatMessage] = ['chatSession', 'chatMessage'].map(model);
    const t = tag();
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const stats = async () => (await (await ad.get('/chat/admin/stats?range=7d')).json()).documents;
    const before = await stats();
    const s = await ChatSession.create({ anonId: 'q'.repeat(32), startedAt: new Date(), lastAt: new Date() });
    const hit = '{"passages":[{"source":"Guide","section":"","text":"<document source=\\"Guide\\">x</document>"}]}';
    const miss = '{"passages":[],"note":"No document covers this. Say you don\'t know and suggest the Contact page."}';
    const src = (title) => ({ type: 'source', id: title, title, section: '' });
    const at = new Date();
    try {
        await ChatMessage.insertMany([
            ...[1, 2, 3].map(() => ({ sessionId: s._id, role: 'tool', toolName: 'search_documents', toolArgs: { query: 'wedding catering' }, toolResultSummary: hit, at })),
            ...[1, 2].map(() => ({ sessionId: s._id, role: 'tool', toolName: 'search_documents', toolArgs: { query: `Helicopter pad ${t}?` }, toolResultSummary: miss, at })),
            { sessionId: s._id, role: 'tool', toolName: 'search_documents', toolArgs: { query: `helicopter pad ${t}` }, toolResultSummary: miss, at },
            { sessionId: s._id, role: 'assistant', content: 'a', cards: [src(`Guide A ${t}`), src(`Guide A ${t}`), src(`Guide B ${t}`)], at },
            { sessionId: s._id, role: 'assistant', content: 'b', cards: [src(`Guide A ${t}`)], at },
        ]);
        const after = await stats();
        check('document lookups counted', after.lookups - before.lookups === 6, `${before.lookups} → ${after.lookups}`);
        const a = after.topSources.find((x) => x.title === `Guide A ${t}`);
        const b2 = after.topSources.find((x) => x.title === `Guide B ${t}`);
        check('top sources: counted once per answer', a?.count === 2 && b2?.count === 1);
        const gap = after.gaps.find((g) => g.question.toLowerCase().includes(`helicopter pad ${t}`));
        check('gaps: questions with no document, grouped (case and punctuation ignored)', gap?.count === 3);
        check('answered questions are not gaps', !after.gaps.some((g) => /wedding catering/.test(g.question)));

        // dashboard
        const b = await chromium.launch();
        const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(`${URL.DASH}/admin/ai-insights`);
        const panel = p.getByTestId('doc-insights');
        const gapRow = () => panel.getByTestId('doc-gap').filter({ hasText: new RegExp(`helicopter pad ${t}`, 'i') });
        await panel.getByText(`Guide A ${t}`).waitFor({ timeout: 15000 });
        check('Insights shows documents used and gaps', /document lookups? in this period/.test(await panel.innerText()) && (await gapRow().count()) === 1);
        await gapRow().getByRole('button', { name: 'Upload a document' }).click();
        await p.waitForURL(/\/admin\/ai-documents/, { timeout: 10000 });
        check('"Upload a document" opens the Documents page', /ai-documents/.test(p.url()));
        await p.goBack();
        await gapRow().waitFor({ timeout: 15000 });
        await gapRow().getByRole('button', { name: 'Create FAQ' }).click();
        await p.waitForURL(/\/admin\/ai-knowledge/, { timeout: 10000 });
        await p.getByLabel('Question').waitFor({ timeout: 10000 });
        check('"Create FAQ" opens the FAQ form with the question filled in', new RegExp(`helicopter pad ${t}`, 'i').test(await p.getByLabel('Question').inputValue()));
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();
    } finally {
        await ChatMessage.deleteMany({ sessionId: s._id });
        await ChatSession.deleteOne({ _id: s._id });
    }
    await done();
})();
