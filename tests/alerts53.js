// Step 5.3: alerts in the dashboard bell (dedupe, AI outage → one alert, escalation link + flood cap, payment issues, role-aware links)
const { chromium } = require('playwright');
const { model, backend, URL, ADMIN, check, connect, done, tag, mongoose } = require('./lib');
(async () => {
    await connect();
    const [Notify, ChatSession, ChatMessage, Order, User] = ['notification', 'chatSession', 'chatMessage', 'order', 'user'].map(model);
    const t = tag();
    const since = new Date();
    const { alert, aiProblem } = backend('services/alerts');
    const created = () => Notify.find({ time: { $gte: since } }).lean();
    const sessions = [];
    try {
        // dedupe
        for (let i = 0; i < 5; i++) await aiProblem('timeout');
        check('5 AI timeouts in a row → one alert', (await Notify.countDocuments({ type: 'ai_error', key: 'ai:timeout', time: { $gte: since } })) === 1);
        await aiProblem('budget');
        await aiProblem('budget');
        check('budget reached → one alert for the day, linking to Assistant settings', (await Notify.find({ type: 'ai_error', key: /^budget:/, time: { $gte: since } }).lean()).filter((n) => n.link === '/admin/ai-settings').length === 1);
        check('unknown AI codes (no key) do not alert', (await aiProblem('disabled')) === false);

        // a real chat turn where the AI fails → fallback answer + alert
        process.env.AI_MOCK = 'false';
        const key = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = 'sk-test-invalid-key-for-alert-test';
        process.env.AI_TIMEOUT_MS = '1';
        await Notify.deleteMany({ type: 'ai_error', key: 'ai:timeout' });
        const { handleMessage } = backend('services/ai/chat');
        const events = [];
        const r = await handleMessage({ text: 'show me pancakes', ctx: { userId: null, anonId: 'a'.repeat(32), userName: null }, emit: (e) => events.push(e) });
        sessions.push(r.sessionId);
        await new Promise((x) => setTimeout(x, 300));
        check('AI failure mid-chat → customer still gets a rule-based answer', r.source === 'fallback' && /pancake/i.test(r.content));
        check('…and the dashboard gets one "assistant switched to rule-based" alert', (await Notify.countDocuments({ type: 'ai_error', time: { $gte: since }, message: /rule-based/ })) >= 1);
        process.env.OPENAI_API_KEY = key || '';
        process.env.AI_TIMEOUT_MS = '20000';

        // escalation: link to the transcript + global cap
        process.env.AI_MOCK = 'true';
        const tools = backend('services/ai/tools');
        const s = await ChatSession.create({ anonId: 'e'.repeat(32) });
        sessions.push(String(s._id));
        await tools.run('escalate_to_human', { reason: 'food was cold' }, { sessionId: s._id, userName: 'Esc' });
        const esc = await Notify.findOne({ type: 'chat_escalation', message: /food was cold/ }).lean();
        check('escalation alert links to its conversation', esc?.link === `/admin/ai-insights?session=${s._id}`);
        await Notify.insertMany(Array.from({ length: 20 }, (_, i) => ({ type: 'chat_escalation', message: `flood ${t} ${i}`, time: new Date() })));
        const s2 = await ChatSession.create({ anonId: 'f'.repeat(32) });
        sessions.push(String(s2._id));
        await tools.run('escalate_to_human', { reason: `spam ${t}` }, { sessionId: s2._id });
        check('more than 20 hand-offs in an hour → no more alerts (chat still marked)', !(await Notify.exists({ message: new RegExp(`spam ${t}`) })) && (await ChatSession.findById(s2._id)).escalated);
        await Notify.deleteMany({ message: new RegExp(`flood ${t}`) });

        // payment issue (paid after cancel) is a payment alert linked to the order, once
        const u = await User.create({ name: 'Pay Alert', email: `pa${t}@x.com`, password: 'x' });
        const o = await Order.create({ userId: u._id, products: [], subtotal: 5, totalAmount: 5, shippingAddress: { fullName: 'P', phone: '+92 300 1234567', line1: 'x st', city: 'Lahore', zip: '54000' }, paymentMethod: 'card', paymentStatus: 'unpaid', orderStatus: 'cancelled' });
        const { markOrderPaid } = backend('services/orderService');
        await markOrderPaid(o._id, { id: `pi_alert_${t}`, status: 'succeeded', amount_received: 500, currency: 'usd' });
        await new Promise((x) => setTimeout(x, 300));
        check('paid after cancel → one payment_issue alert for that order', (await Notify.countDocuments({ type: 'payment_issue', orderId: o._id })) === 1);
        await alert({ type: 'payment_issue', message: 'dup', orderId: o._id, key: `paid-after-cancel:${o._id}`, windowMs: 365 * 864e5 });
        check('…not repeated', (await Notify.countDocuments({ type: 'payment_issue', orderId: o._id })) === 1);

        // the bell: icons, and links that respect the role
        const b = await chromium.launch();
        const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(e.message));
        await p.goto(`${URL.DASH}/admin/dashboard`);
        await p.waitForTimeout(2500);
        await p.getByRole('button', { name: /notifications/i }).first().click();
        await p.waitForTimeout(800);
        await p.getByRole('button', { name: /asked for a person in chat: food was cold/ }).click();
        await p.waitForTimeout(2500);
        check('clicking a hand-off alert opens Insights with that conversation', /\/admin\/ai-insights/.test(p.url()) && (await p.locator('.MuiDrawer-paperAnchorRight').count()) === 1);
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();
        await Promise.all([Order.deleteOne({ _id: o._id }), User.deleteOne({ _id: u._id }), model('payment').deleteMany({ orderId: o._id })]);
    } finally {
        await ChatMessage.deleteMany({ sessionId: { $in: sessions } });
        await ChatSession.deleteMany({ _id: { $in: sessions } });
        await Notify.deleteMany({ time: { $gte: since }, type: { $in: ['ai_error', 'chat_escalation', 'payment_issue'] } });
    }
    await done();
})();
