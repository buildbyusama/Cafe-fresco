// Step 3.5: knowledge base (roles, CRUD, drafts never used, re-embedding on edit, threshold, assistant answers from it)
process.env.AI_MOCK = 'true';
const { request } = require('playwright');
const { model, backend, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [Knowledge, Admin, ChatSession, ChatMessage] = ['knowledge', 'admin', 'chatSession', 'chatMessage'].map(model);
    const { embedKnowledge } = backend('services/ai/embeddings');
    const t = tag();
    const created = [];
    const ctx = () => request.newContext({ baseURL: URL.API });
    const ad = await ctx();
    await ad.post('/admin/login', { data: ADMIN });
    const ed = await Admin.create({ name: 'KB Ed', email: `kbe${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' });
    const e = await ctx();
    await e.post('/admin/login', { data: { email: ed.email, password: 'Pass1234' } });
    const sessions = [];
    try {
        check('editor cannot list the FAQ (403)', (await e.get('/knowledge')).status() === 403);
        check('editor cannot add (403)', (await e.post('/knowledge', { data: { question: 'Test question?', answer: 'x' } })).status() === 403);
        check('guest cannot list (401)', (await (await ctx()).get('/knowledge')).status() === 401);
        check('validation: short question → 400', (await ad.post('/knowledge', { data: { question: 'Hi', answer: 'x' } })).status() === 400);

        const add = await ad.post('/knowledge', { data: { question: `Do you deliver birthday cakes ${t}?`, answer: `Yes, order birthday cakes ${t} two days ahead by phone.`, tags: ['Cakes'] } });
        const entry = (await add.json()).entry;
        created.push(entry._id);
        check('admin adds → 201, starts as a draft', add.status() === 201 && entry.isActive === false && entry.tags[0] === 'cakes');
        const guest = await ctx();
        const ask = async (text) => {
            const r = await guest.post('/chat/message', { data: { text } });
            const body = await r.text();
            const sid = body.match(/"sessionId":"([0-9a-f]{24})"/)?.[1];
            if (sid) sessions.push(sid);
            return body.split('\n').filter((l) => l.startsWith('data: ') && l.includes('"text"')).map((l) => JSON.parse(l.slice(6)).text).join('');
        };
        check('a draft is never used by the assistant', !(await ask(`do you deliver birthday cakes ${t}`)).includes('two days ahead'));
        await ad.put(`/knowledge/${entry._id}`, { data: { isActive: true } });
        const answer = await ask(`do you deliver birthday cakes ${t}`);
        check('published entry → the assistant answers with it', answer.includes('two days ahead'), answer.slice(0, 120));
        const test = await (await ad.post('/knowledge/test', { data: { question: `birthday cakes ${t} delivery` } })).json();
        check('"test a question" shows the matching entry', test.entries[0]?.question.includes('birthday cakes'));
        check('unrelated question matches nothing', (await (await ad.post('/knowledge/test', { data: { question: 'quantum chromodynamics lecture notes' } })).json()).entries.length === 0);

        // embeddings (mock, in-process): first embed, unchanged skip, edit re-embeds
        const first = await embedKnowledge([entry._id]);
        const again = await embedKnowledge([entry._id]);
        await ad.put(`/knowledge/${entry._id}`, { data: { answer: `Yes: birthday cakes ${t} need two days' notice.` } });
        await new Promise((r) => setTimeout(r, 300));
        const edited = await embedKnowledge([entry._id]);
        check('embeddings: created, skipped when unchanged, redone after an edit', first.embedded + again.embedded <= 1 && again.embedded === 0 && edited.embedded === 1, JSON.stringify([first, again, edited]));

        const html = await ad.post('/knowledge', { data: { question: `Script test ${t}?`, answer: '<script>alert(1)</script> plain' } });
        created.push((await html.json()).entry._id);
        check('answers are stored as plain text (the widget renders text, never HTML)', (await Knowledge.findById(created[1]).lean()).answer.startsWith('<script>'));
        const list = await (await ad.get(`/knowledge?q=${t}&status=active`)).json();
        check('list filters by text and status', list.entries.length === 1 && list.entries[0]._id === entry._id);
        check('delete → 200, then 404', (await ad.delete(`/knowledge/${entry._id}`)).status() === 200 && (await ad.delete(`/knowledge/${entry._id}`)).status() === 404);
        check('8 starter drafts exist and are inactive', (await Knowledge.countDocuments({ answer: /^DRAFT:/, isActive: false })) === 8);
    } finally {
        await Knowledge.deleteMany({ _id: { $in: created } });
        await Admin.deleteOne({ _id: ed._id });
        await ChatMessage.deleteMany({ sessionId: { $in: sessions } });
        await ChatSession.deleteMany({ _id: { $in: sessions } });
    }
    await done();
})();
