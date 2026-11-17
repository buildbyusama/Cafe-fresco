// Step 6.3: activity log (one row per admin change, secrets hidden, failures not logged, roles, filters, page) + error-burst alert
const { EventEmitter } = require('events');
const { request, chromium } = require('playwright');
const { model, backend, bcrypt, URL, ADMIN, check, connect, done, tag } = require('./lib');
(async () => {
    await connect();
    const [AuditLog, Category, Admin, Notify] = ['auditLog', 'category', 'admin', 'notification'].map(model);
    const t = tag();
    const since = new Date();
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: ADMIN });
    const newRows = async () => {
        await new Promise((r) => setTimeout(r, 400));
        return AuditLog.find({ at: { $gte: since } }).sort({ at: 1 }).lean();
    };
    let catId = null;
    try {
        const add = await ad.post('/category/add', { multipart: { title: `Audit Cat ${t}` } });
        catId = (await add.json()).category._id;
        await ad.put(`/category/update/${catId}`, { multipart: { description: 'changed' } });
        await ad.post('/category/add', { multipart: { title: '' } }); // 400: not logged
        await ad.post('/admin/create-permission', { data: { name: 'Audit Helper', email: `audh${t}@x.com`, password: 'Secret123!', role: 'editor' } });
        await ad.delete('/admin/delete-permission', { data: { email: `audh${t}@x.com` } });
        await ad.delete(`/category/delete/${catId}`);
        catId = null;
        const rows = await newRows();
        const sig = rows.map((r) => `${r.action}:${r.entity}`);
        check('each successful change → one row (create/update/delete category, create/delete permission)', JSON.stringify(sig) === JSON.stringify(['create:category', 'update:category', 'create:permission', 'delete:permission', 'delete:category']), JSON.stringify(sig));
        check('failed request (400) is not logged', !rows.some((r) => r.changes?.title === ''));
        const perm = rows.find((r) => r.entity === 'permission' && r.action === 'create');
        check('password hidden in the logged changes', perm.changes.password === '[hidden]' && !JSON.stringify(rows).includes('Secret123!'));
        check('who did it is recorded (name + role)', rows.every((r) => r.adminName && r.role === 'admin'));
        check('update row keeps the category id and the changed field', rows[1].entityId === String(rows[0].entityId) && rows[1].changes.description === 'changed');
        check('reading notifications or signing in is not logged', !rows.some((r) => /login|mark-seen/.test(r.summary)));

        const list = await (await ad.get('/audit?entity=category&action=delete')).json();
        check('filters by area and action', list.entries.length >= 1 && list.entries.every((e) => e.entity === 'category' && e.action === 'delete'));
        check('bad date → 400', (await ad.get('/audit?from=yesterday')).status() === 400);
        const ed = await Admin.create({ name: 'Aud Ed', email: `aude${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' });
        const e = await request.newContext({ baseURL: URL.API });
        await e.post('/admin/login', { data: { email: ed.email, password: 'Pass1234' } });
        check('editor → 403 on the log', (await e.get('/audit')).status() === 403);
        await Admin.deleteOne({ _id: ed._id });

        // error burst → one alert (middleware driven with fake responses)
        const { errorBurst } = backend('services/audit');
        const fire = () => { const res = new EventEmitter(); res.statusCode = 500; errorBurst({}, res, () => {}); res.emit('finish'); };
        for (let i = 0; i < 25; i++) fire();
        await new Promise((r) => setTimeout(r, 500));
        check('25 server errors in a minute → one system alert', (await Notify.countDocuments({ type: 'system_error', key: 'burst', time: { $gte: since } })) === 1);
        const health = await (await ad.get('/health')).json();
        check('/health reports db + ai status', health.db === 'up' && 'ai' in health);

        // page
        const b = await chromium.launch();
        const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: ADMIN });
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (x) => errs.push(x.message));
        await p.goto(`${URL.DASH}/admin/activity-log`);
        await p.getByText('Who', { exact: true }).waitFor({ timeout: 45000 });
        check('activity log page lists changes', (await p.getByText(`title: Audit Cat ${t}`).count()) >= 1);
        await p.getByLabel('Action').click();
        await p.getByRole('option', { name: 'Deleted' }).click();
        await p.waitForTimeout(1200);
        check('action filter works on the page', (await p.locator('tbody').getByText('Created').count()) === 0 && (await p.locator('tbody').getByText('Deleted').count()) >= 1);
        if (process.argv[2]) await p.screenshot({ path: `${process.argv[2]}/activity.png`, fullPage: true });
        check('no page errors', errs.length === 0, errs[0]);
        await b.close();
    } finally {
        if (catId) await Category.deleteOne({ _id: catId });
        await AuditLog.deleteMany({ at: { $gte: since }, $or: [{ changes: { $exists: true } }] , summary: { $not: /reindex/ }, entity: { $in: ['category', 'permission'] } });
        await Notify.deleteMany({ time: { $gte: since }, type: { $in: ['system_error', 'permission'] } });
        await Admin.deleteMany({ email: new RegExp(t) });
    }
    await done();
})();
