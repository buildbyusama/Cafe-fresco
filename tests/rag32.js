// RAG R3.2: "Sources" chips in the chat widget and the dashboard transcript (stored on the message, history, 360 px, XSS)
process.env.AI_MOCK = 'true';
const { chromium, request } = require('playwright');
const { model, backend, URL, ADMIN, check, connect, done, tag } = require('./lib');

(async () => {
    await connect();
    const [Document, DocChunk, ChatSession, ChatMessage] = ['document', 'docChunk', 'chatSession', 'chatMessage'].map(model);
    const { ingest } = backend('services/rag/ingest');
    const { changed } = backend('services/rag/documents');
    const { handleMessage } = backend('services/ai/chat');
    const t = tag();
    const made = [];
    const sessions = [];
    const b = await chromium.launch();
    try {
        // backend: source cards are stored on the reply and reach the admin transcript
        const d = await Document.create({ title: `Catering Guide ${t}`, mime: 'text/plain', sha256: `${t}-r32` });
        made.push(d._id);
        await ingest(d._id, Buffer.from('# Wedding catering\n\nWedding catering needs seven days notice and a deposit of thirty percent before the event.'), 'x.txt');
        await Document.updateOne({ _id: d._id }, { isPublished: true });
        changed();
        const guest = { userId: null, anonId: 's'.repeat(32), userName: null, reqId: 'rag32' };
        const r = await handleMessage({ text: 'Do you do wedding catering?', ctx: guest, emit: () => {} });
        sessions.push(r.sessionId);
        const stored = await ChatMessage.findOne({ sessionId: r.sessionId, role: 'assistant' }).lean();
        check('source cards are stored on the reply', stored.cards.some((c) => c.type === 'source' && c.title === `Catering Guide ${t}` && c.section === 'Wedding catering'));
        const r2 = await handleMessage({ text: 'what is the capital of france', ctx: guest, emit: () => {} });
        sessions.push(r2.sessionId);
        check('no sources for answers that used no document', !r2.cards.some((c) => c.type === 'source'));
        const ad = await request.newContext({ baseURL: URL.API });
        await ad.post('/admin/login', { data: ADMIN });
        const trAlt = await (await ad.get(`/chat/admin/sessions/${r.sessionId}`)).json().catch(() => ({}));
        check('dashboard transcript lists the sources', (trAlt.messages || []).some((m) => m.sources?.some((s) => s.title === `Catering Guide ${t}`)));

        // widget: a streamed answer with sources (network answer stubbed: the UI is under test, not the model)
        const longTitle = `A very long catering and events handbook title for weddings and corporate parties ${t}`;
        const xss = `<img src=x onerror="window.__xss=1"> Policy ${t}`;
        const sse = (events) => events.map(([e, data]) => `event: ${e}\ndata: ${JSON.stringify(data)}\n\n`).join('');
        const reply = sse([
            ['session', { sessionId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }],
            ['cards', { cards: [{ type: 'source', id: 'a', title: longTitle, section: 'Weddings' }, { type: 'source', id: 'b', title: xss, section: '' }] }],
            ['token', { text: 'Wedding catering needs seven days notice. (from Catering Guide)' }],
            ['done', { messageId: 'bbbbbbbbbbbbbbbbbbbbbbbb', source: 'ai' }],
        ]);
        const history = { messages: [
            { id: 'u1', role: 'user', content: 'catering?', cards: [] },
            { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role: 'assistant', content: 'Wedding catering needs seven days notice.', cards: [{ type: 'source', id: 'a', title: longTitle, section: 'Weddings' }] },
            { id: 'u2', role: 'user', content: 'hi', cards: [] },
            { id: 'cccccccccccccccccccccccc', role: 'assistant', content: 'Hi! How can I help?', cards: [] },
        ] };
        for (const width of [1366, 360]) {
            const ctx = await b.newContext({ viewport: { width, height: 760 } });
            const p = await ctx.newPage();
            const errs = [];
            p.on('pageerror', (e) => errs.push(e.message));
            await p.route('**/chat/message', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: reply }));
            await p.route('**/chat/session/aaaaaaaaaaaaaaaaaaaaaaaa', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(history) }));
            await p.goto(URL.SHOP + '/');
            await p.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).click();
            await p.getByLabel('Message').fill('Do you do wedding catering?');
            await p.getByLabel('Message').press('Enter');
            await p.locator('.cc-source').first().waitFor({ timeout: 10000 });
            const chips = p.locator('.cc-source');
            check(`${width}px: Sources chips shown under the answer`, (await chips.count()) === 2 && (await p.locator('.cc-sources-label').first().innerText()) === 'Sources');
            check(`${width}px: XSS in a title renders as text`, (await chips.nth(1).innerText()).includes('<img') && !(await p.evaluate(() => window.__xss)));
            const fits = await p.evaluate(() => {
                const panel = document.querySelector('.cc-sources').closest('[role="dialog"]').getBoundingClientRect();
                return [...document.querySelectorAll('.cc-source')].every((c) => c.getBoundingClientRect().right <= panel.right + 1) && document.documentElement.scrollWidth <= window.innerWidth;
            });
            const chip0 = await chips.first().evaluate((c) => ({ cut: c.scrollWidth > c.clientWidth, ellipsis: getComputedStyle(c).textOverflow, title: c.title }));
            check(`${width}px: no overflow; long title cut with an ellipsis and a tooltip`, fits && chip0.ellipsis === 'ellipsis' && chip0.title === `${longTitle} › Weddings` && (width > 400 || chip0.cut));
            if (width === 360) await p.screenshot({ path: process.env.SHOT_DIR ? require('path').join(process.env.SHOT_DIR, 'rag32-360.png') : require('os').tmpdir() + '/rag32-360.png' });

            // history reload keeps the chips, only on the document-based answer
            await p.reload();
            await p.getByRole('button', { name: 'Open the Cafe Fresco assistant' }).click();
            await p.locator('.cc-source').first().waitFor({ timeout: 10000 });
            check(`${width}px: chips survive a history reload, only on the document answer`, (await p.locator('.cc-sources').count()) === 1 && (await p.locator('.cc-msg.is-bot').last().locator('.cc-sources').count()) === 0);
            check(`${width}px: no page errors`, errs.length === 0, errs.join(' | '));
            await ctx.close();
        }
    } finally {
        await b.close();
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
        await ChatMessage.deleteMany({ sessionId: { $in: sessions } });
        await ChatSession.deleteMany({ _id: { $in: sessions } });
    }
    await done();
})();
