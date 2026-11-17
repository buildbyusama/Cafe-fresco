// RAG R4.1: dashboard Documents page (roles, upload → ready, privacy confirm, replace, failed reason, test box,
// delete confirm, polling stops, double-click = one request, size check before upload, 360/1440 screenshots)
const path = require('path');
const { chromium } = require('playwright');
const { model, bcrypt, URL, check, connect, done, tag } = require('./lib');
const PARA = (s) => `Cafe Fresco catering ${s}: weddings and office events need seven days notice and a thirty percent deposit.`;

(async () => {
    await connect();
    const [Admin, Document, DocChunk] = ['admin', 'document', 'docChunk'].map(model);
    const t = tag();
    const shots = process.argv[2] || require('os').tmpdir();
    const mgr = await Admin.create({ name: 'Docs UI', email: `docsui${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'manager' });
    const ed = await Admin.create({ name: 'Docs Ed', email: `docsed${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' });
    const b = await chromium.launch();
    const errs = [];
    const login = async (who, width = 1440) => {
        const ctx = await b.newContext({ viewport: { width, height: 900 } });
        await ctx.request.post(`${URL.API}/admin/login`, { data: { email: who.email, password: 'Pass1234' } });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => errs.push(e.message));
        return p;
    };
    const file = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
    const row = (p, title) => p.locator('[data-testid="doc-row"]', { hasText: title });
    try {
        const ep = await login(ed);
        await ep.goto(`${URL.DASH}/admin/ai-documents`);
        await ep.waitForTimeout(2500);
        check('editor is denied the page and has no menu link', (await ep.getByText('Upload a document').count()) === 0 && (await ep.locator('a[href="/admin/ai-documents"]').count()) === 0);

        const p = await login(mgr);
        await p.goto(`${URL.DASH}/admin/ai-documents`);
        await p.getByText('Upload a document').waitFor({ timeout: 15000 });
        check('manager sees the page with the library usage', /of 50 documents/.test(await p.locator('body').innerText()));

        // upload (double click → one request)
        let posts = 0;
        p.on('request', (r) => r.method() === 'POST' && /\/documents$/.test(r.url()) && posts++);
        await p.getByLabel('Title (optional)').fill(`Wedding Guide ${t}`);
        await p.getByTestId('doc-file').setInputFiles(file('guide.txt', `# Wedding catering\n\n${PARA(t)}`));
        await p.getByTestId('doc-file').setInputFiles(file('guide2.txt', `# Wedding catering\n\n${PARA(`${t} again`)}`)); // second pick while the first is uploading
        await row(p, `Wedding Guide ${t}`).waitFor({ timeout: 15000 });
        await p.waitForTimeout(800);
        check('upload → Ready in the table', /Ready/.test(await row(p, `Wedding Guide ${t}`).innerText()));
        check('a second pick during an upload sends no extra request', posts === 1, `posts=${posts}`);

        // over the size limit: blocked in the browser with the server's words
        const before = posts;
        await p.getByTestId('doc-file').setInputFiles({ name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(11 * 1024 * 1024, 65) });
        await p.getByText('Files must be under 10 MB').first().waitFor({ timeout: 5000 });
        check('a file over the limit is blocked before upload with the server message', posts === before);

        // publish; privacy confirmation
        await p.getByLabel(`Published: Wedding Guide ${t}`).click();
        await p.waitForTimeout(800);
        check('publish switch works', (await Document.findOne({ title: `Wedding Guide ${t}` }).lean()).isPublished === true);
        await p.getByLabel('Title (optional)').fill(`Staff Sheet ${t}`);
        await p.getByTestId('doc-file').setInputFiles(file('staff.txt', `${PARA(`staff ${t}`)} Call Ali on +92 300 1234567 or ali@example.com.`));
        await row(p, `Staff Sheet ${t}`).waitFor({ timeout: 15000 });
        check('privacy badge shown', /Personal data\?/.test(await row(p, `Staff Sheet ${t}`).innerText()));
        await p.getByLabel(`Published: Staff Sheet ${t}`).click();
        await p.getByRole('dialog').getByText('may contain personal data').waitFor({ timeout: 5000 });
        check('publishing asks for confirmation listing the flags', /phone numbers|email addresses/.test(await p.getByRole('dialog').innerText()));
        await p.getByRole('button', { name: 'Publish anyway' }).click();
        await p.waitForTimeout(800);
        check('confirmed → published', (await Document.findOne({ title: `Staff Sheet ${t}` }).lean()).isPublished === true);

        // replace keeps title + published
        await p.getByLabel(`Replace file: Wedding Guide ${t}`).click();
        await p.getByTestId('doc-replace').setInputFiles(file('v2.txt', `# Wedding catering v2\n\n${PARA(`v2 ${t}`)}`));
        await p.waitForTimeout(2000);
        const rep = await Document.findOne({ title: `Wedding Guide ${t}` }).lean();
        check('replace keeps the title and published state', rep.servingVersion === 2 && rep.isPublished === true);

        // failed document shows its reason
        await p.getByLabel('Title (optional)').fill(`Broken ${t}`);
        await p.getByTestId('doc-file').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.7\n${'junk '.repeat(50)}${t}`) });
        await row(p, `Broken ${t}`).waitFor({ timeout: 15000 });
        check('a failed document shows Failed and its reason', /Failed/.test(await row(p, `Broken ${t}`).innerText()) && (await row(p, `Broken ${t}`).getByTestId('doc-error').count()) === 1);
        check('a failed document cannot be published (switch disabled)', await p.getByLabel(`Published: Broken ${t}`).isDisabled());

        // test box
        await p.getByLabel('Test question').fill('how many days notice for wedding catering');
        await p.getByRole('button', { name: 'Test', exact: true }).click();
        await p.getByTestId('test-results').waitFor({ timeout: 10000 });
        check('test box shows passages with source and score', /score/.test(await p.getByTestId('test-results').innerText()));

        // detail drawer
        await row(p, `Wedding Guide ${t}`).getByRole('button', { name: `Wedding Guide ${t}`, exact: true }).click();
        await p.getByText('First passages').waitFor({ timeout: 5000 });
        check('detail drawer shows the first passages', /v2/.test(await p.locator('.MuiDrawer-paperAnchorRight').innerText()));
        await p.getByRole('button', { name: 'Close' }).click();

        // polling only while processing
        let gets = 0;
        p.on('request', (r) => r.method() === 'GET' && /\/documents$/.test(r.url()) && gets++);
        await p.waitForTimeout(7000);
        check('no polling when nothing is processing', gets === 0, `gets=${gets}`);
        const proc = await Document.create({ title: `Processing ${t}`, mime: 'text/plain', sha256: `${t}-proc`, status: 'processing' });
        await p.reload();
        await p.getByText('Upload a document').waitFor();
        gets = 0;
        await p.waitForTimeout(7000);
        check('polls every 3 s while a document is processing', gets >= 2, `gets=${gets}`);
        await Document.updateOne({ _id: proc._id }, { status: 'failed', error: 'x' });
        await p.waitForTimeout(3500);
        gets = 0;
        await p.waitForTimeout(7000);
        check('polling stops when everything is settled', gets === 0, `gets=${gets}`);

        // delete asks first
        await p.getByLabel(`Delete: Staff Sheet ${t}`).click();
        await p.getByRole('dialog').getByText('Delete this document?').waitFor({ timeout: 5000 });
        await p.getByRole('button', { name: 'Cancel' }).click();
        await p.waitForTimeout(500);
        check('delete asks for confirmation (cancel keeps it)', (await Document.countDocuments({ title: `Staff Sheet ${t}` })) === 1);
        await p.getByLabel(`Delete: Staff Sheet ${t}`).click();
        await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
        await p.waitForTimeout(1000);
        check('confirmed delete removes it', (await Document.countDocuments({ title: `Staff Sheet ${t}` })) === 0);
        await p.screenshot({ path: path.join(shots, 'rag41-1440.png'), fullPage: true });

        // 360 px
        const m = await login(mgr, 360);
        await m.goto(`${URL.DASH}/admin/ai-documents`);
        await m.getByText('Upload a document').waitFor({ timeout: 15000 });
        await m.waitForTimeout(800);
        check('360 px: no page-wide horizontal scroll', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
        await m.screenshot({ path: path.join(shots, 'rag41-360.png'), fullPage: true });
        check('no page errors', errs.length === 0, errs[0]);
    } finally {
        await b.close();
        const docs = await Document.find({ title: { $regex: t } }).select('_id').lean();
        await DocChunk.deleteMany({ documentId: { $in: docs.map((d) => d._id) } });
        await Document.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
        await Admin.deleteMany({ _id: { $in: [mgr._id, ed._id] } });
    }
    await done();
})();
