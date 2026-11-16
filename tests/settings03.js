// Step 0.3: store settings (roles, validation, public view, open-now edges, shop reads them)
const { request, chromium } = require('playwright');
const { model, backend, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const Admin = model('admin');
    const Setting = model('setting');
    const { openNow } = backend('services/settings');
    const { TZ } = backend('services/stats');
    const moment = require('../cafeFresco-backend/node_modules/moment-timezone');
    const original = await Setting.findOne({ key: 'store' }).lean();
    const t = tag();

    // open-now edges (Monday 09:00–23:00, Friday 18:00–02:00, Sunday closed)
    const hours = [{ day: 1, open: '09:00', close: '23:00' }, { day: 5, open: '18:00', close: '02:00' }, { day: 0, closed: true, open: '', close: '' }];
    const at = (iso) => moment.tz(iso, TZ); // 2026-11-16 is a Monday
    check('Mon 08:59 closed', openNow(hours, at('2026-11-16T08:59')) === false);
    check('Mon 09:00 open', openNow(hours, at('2026-11-16T09:00')) === true);
    check('Mon 22:59 open, 23:00 closed', openNow(hours, at('2026-11-16T22:59')) === true && openNow(hours, at('2026-11-16T23:00')) === false);
    check('Fri 23:30 open (closes after midnight)', openNow(hours, at('2026-11-20T23:30')) === true);
    check('Sat 01:59 still open from Friday, 02:00 closed', openNow(hours, at('2026-11-21T01:59')) === true && openNow(hours, at('2026-11-21T02:00')) === false);
    check('Sunday closed', openNow(hours, at('2026-11-22T12:00')) === false);
    check('no hours → null (unknown)', openNow([], at('2026-11-16T12:00')) === null);

    // roles
    const anon = await request.newContext({ baseURL: URL.API });
    check('guest PUT → 401', (await anon.put('/settings', { data: {} })).status() === 401);
    const mgr = await Admin.create({ name: 'Set Mgr', email: `setm${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'manager' });
    const m = await request.newContext({ baseURL: URL.API });
    await m.post('/admin/login', { data: { email: mgr.email, password: 'Pass1234' } });
    check('manager PUT → 403', (await m.put('/settings', { data: { contact: {} } })).status() === 403);
    check('manager GET full → 403', (await m.get('/settings')).status() === 403);
    await Admin.deleteOne({ _id: mgr._id });

    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const bad = await ad.put('/settings', { data: { contact: { phone: 'call me', email: 'nope', mapUrl: 'javascript:alert(1)' } } });
    const badJson = await bad.json();
    check('invalid contact → 400 with field errors', bad.status() === 400 && badJson.fields['contact.phone'] && badJson.fields['contact.email'] && badJson.fields['contact.mapUrl']);
    check('half-filled day rejected', (await ad.put('/settings', { data: { hours: [{ day: 2, open: '09:00', close: '' }] } })).status() === 400);
    check('both payment methods off rejected', (await ad.put('/settings', { data: { payments: { card: false, cod: false } } })).status() === 400);
    check('non-https social link rejected', (await ad.put('/settings', { data: { social: { instagram: 'http://insta.com/x' } } })).status() === 400);

    const phone = '+92 300 7654321';
    const ok = await ad.put('/settings', { data: { contact: { phone, email: 'hello@cafefresco.test', address: '12 Test Road', mapUrl: '' }, hours, social: { facebook: '', instagram: 'https://instagram.com/cafefresco.test', twitter: '' }, chatbot: { escalationEmail: 'boss@cafefresco.test' } } });
    check('admin save → 200', ok.status() === 200);
    const pub = await (await anon.get('/settings/public')).json();
    check('public view shows contact + hours + openNow', pub.contact?.phone === phone && pub.hours?.length === 3 && 'openNow' in pub);
    check('public view hides escalationEmail, budget and ids', !JSON.stringify(pub).includes('boss@') && !('dailyTokenBudget' in (pub.chatbot || {})) && !pub._id);
    check('default policies come from real system rules', /pending and unpaid/.test(pub.policies?.cancellation || ''));

    // shop reads it
    const b = await chromium.launch();
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${URL.SHOP}/contact`);
    await p.waitForTimeout(1500);
    const body = await p.locator('body').innerText();
    check('contact page shows the saved phone and hours', body.includes(phone) && /Mon 9am – 11pm/.test(body), body.match(/Mon[^\n]*/)?.[0]);
    check('footer shows the Instagram link only', (await p.locator('.cf-social a').count()) === 1 && (await p.locator('.cf-social a').getAttribute('href')) === 'https://instagram.com/cafefresco.test');
    check('no page errors', errs.length === 0, errs[0]);
    await b.close();

    // restore
    await Setting.deleteOne({ key: 'store' });
    if (original) await Setting.create(original);
    backend('services/settings').bust();
    await done();
})();
