// Step 3.4: chat API (SSE shape, ownership, feedback, delete, limits, disabled, size)
const { request } = require('playwright');
const { model, URL, ADMIN, check, connect, done, tag } = require('./lib');

// parse an SSE body into [{event, data}]
const events = (body) => body.split('\n\n').filter((b) => b.startsWith('event:')).map((b) => ({ event: b.match(/^event: (.+)$/m)[1], data: JSON.parse(b.match(/^data: (.+)$/m)[1]) }));

(async () => {
    await connect();
    const [ChatSession, ChatMessage, User] = ['chatSession', 'chatMessage', 'user'].map(model);
    const t = tag();
    const sessions = [];
    const ctx = () => request.newContext({ baseURL: URL.API });
    const say = async (c, text, sessionId) => {
        const r = await c.post('/chat/message', { data: { text, ...(sessionId ? { sessionId } : {}) } });
        const body = await r.text();
        const ev = r.headers()['content-type']?.includes('text/event-stream') ? events(body) : [];
        const sid = ev.find((e) => e.event === 'session')?.data.sessionId;
        if (sid) sessions.push(sid);
        return { status: r.status(), headers: r.headers(), ev, sid, body };
    };
    try {
        const g = await ctx();
        const r = await say(g, 'show me pancakes');
        check('SSE response: event-stream, no buffering headers', r.status === 200 && /text\/event-stream/.test(r.headers['content-type']) && r.headers['x-accel-buffering'] === 'no' && /no-cache/.test(r.headers['cache-control']));
        check('events in order: session → cards/tokens → done', r.ev[0].event === 'session' && r.ev.at(-1).event === 'done' && r.ev.some((e) => e.event === 'token'), r.ev.map((e) => e.event).join(','));
        check('guest gets a signed guest cookie', (await g.storageState()).cookies.some((c) => c.name === 'cf_anon'));
        const hist = await (await g.get(`/chat/session/${r.sid}`)).json();
        check('own history: user + assistant, no tool internals', hist.messages.length === 2 && hist.messages.every((m) => ['user', 'assistant'].includes(m.role)) && !JSON.stringify(hist).includes('toolArgs'));
        const other = await ctx();
        check("another guest can't read it (404)", (await other.get(`/chat/session/${r.sid}`)).status() === 404);
        check("another guest can't delete it (404)", (await other.delete(`/chat/session/${r.sid}`)).status() === 404);
        const reply = hist.messages.find((m) => m.role === 'assistant');
        check("another guest can't leave feedback on it (404)", (await other.post('/chat/feedback', { data: { messageId: reply.id, value: 'down' } })).status() === 404);
        check('owner feedback 200 and stored', (await g.post('/chat/feedback', { data: { messageId: reply.id, value: 'up', note: 'nice' } })).status() === 200 && (await ChatMessage.findById(reply.id)).feedback === 'up');
        check('bad feedback value → 400', (await g.post('/chat/feedback', { data: { messageId: reply.id, value: 'meh' } })).status() === 400);
        const stolen = await say(other, 'hello', r.sid);
        check("posting into someone else's session starts a new chat", stolen.sid && stolen.sid !== r.sid);

        // logged-in customer: guest chats don't leak into the account and vice versa
        const cust = await ctx();
        await cust.post('/user/register', { data: { name: 'Chat Api', email: `capi${t}@x.com`, password: 'Chatapi12' } });
        const cr = await say(cust, 'track my order');
        check('customer chat stored under the account', String((await ChatSession.findById(cr.sid)).userId) === String((await User.findOne({ email: `capi${t}@x.com` }))._id));
        check("the guest can't read the customer's chat", (await g.get(`/chat/session/${cr.sid}`)).status() === 404);
        check('delete own chat 200, then gone', (await cust.delete(`/chat/session/${cr.sid}`)).status() === 200 && !(await ChatSession.findById(cr.sid)) && (await ChatMessage.countDocuments({ sessionId: cr.sid })) === 0);

        // input limits
        check('empty message → 400', (await g.post('/chat/message', { data: { text: '   ' } })).status() === 400);
        check('1001 chars → 400', (await g.post('/chat/message', { data: { text: 'x'.repeat(1001) } })).status() === 400);
        check('body over 4 KB → 413', (await g.post('/chat/message', { data: { text: 'hi', pad: 'x'.repeat(5000) } })).status() === 413);
        check('bad session id → 400', (await g.post('/chat/message', { data: { text: 'hi', sessionId: 'nope' } })).status() === 400);

        // turned off in Store Info → 503 with a friendly message
        const ad = await ctx();
        await ad.post('/admin/login', { data: ADMIN });
        const before = await (await ad.get('/settings')).json();
        await ad.put('/settings', { data: { chatbot: { ...before.chatbot, enabled: false } } });
        const off = await g.post('/chat/message', { data: { text: 'hi' } });
        check('chat disabled → 503 with a message', off.status() === 503 && /taking a break/.test((await off.json()).message));
        await ad.put('/settings', { data: { chatbot: { ...before.chatbot, enabled: true } } });
        check('re-enabled → 200', (await say(g, 'hello')).status === 200);

        // guest limit: 10 per 5 minutes per guest
        const spam = await ctx();
        let hit = 0;
        for (let i = 0; i < 12 && !hit; i++) {
            const s = await spam.post('/chat/message', { data: { text: `hello ${i}` } });
            if (s.status() === 429) hit = i + 1;
            else sessions.push(events(await s.text()).find((e) => e.event === 'session')?.data.sessionId);
        }
        check('guest rate limit: the 11th message in 5 min → 429', hit === 11, `hit at ${hit}`);
        check('admin cookie is not a customer identity for chat (treated as guest)', (await say(ad, 'track my order')).body.includes('log in'));
    } finally {
        const u = await User.findOne({ email: `capi${t}@x.com` });
        const own = u ? await ChatSession.find({ userId: u._id }).select('_id').lean() : [];
        const all = [...sessions.filter(Boolean), ...own.map((s) => String(s._id))];
        await ChatMessage.deleteMany({ sessionId: { $in: all } });
        await ChatSession.deleteMany({ _id: { $in: all } });
        if (u) await User.deleteOne({ _id: u._id });
    }
    await done();
})();
