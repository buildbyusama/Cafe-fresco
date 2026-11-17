// RAG R2.1: document admin API (roles, upload limits, duplicates, publish rules, privacy confirm, replace, delete, reindex, audit)
const { request } = require('playwright');
const { Document: Docx, Packer, Paragraph } = require('docx');
const { model, bcrypt, URL, check, connect, done, tag } = require('./lib');
const PARA = (s) => `Cafe Fresco catering ${s}: we serve weddings, birthdays and office events with menus planned for each client and fresh food delivered on time.`;

(async () => {
    await connect();
    const [Document, DocChunk, Admin, AuditLog] = ['document', 'docChunk', 'admin', 'auditLog'].map(model);
    const t = tag();
    const since = new Date();
    // a fresh manager each run: the 20-uploads-per-hour limit is counted per admin
    const mgr = await Admin.create({ name: 'Doc Mgr', email: `docmgr${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'manager' });
    const ad = await request.newContext({ baseURL: URL.API });
    await ad.post('/admin/login', { data: { email: mgr.email, password: 'Pass1234' } });
    const ed = await Admin.create({ name: 'Doc Ed', email: `doced${t}@x.com`, password: await bcrypt.hash('Pass1234', 10), role: 'editor' });
    const e = await request.newContext({ baseURL: URL.API });
    await e.post('/admin/login', { data: { email: ed.email, password: 'Pass1234' } });
    const file = (name, text, mimeType = 'text/plain') => ({ file: { name, mimeType, buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) } });
    const created = [];
    const upload = async (ctx, name, text, extra = {}) => {
        const r = await ctx.post('/documents', { multipart: { ...file(name, text), ...extra } });
        const j = await r.json().catch(() => ({}));
        if (j.document?._id) created.push(j.document._id);
        return { status: r.status(), j };
    };
    try {
        check('editor → 403', (await upload(e, 'x.txt', PARA('editor'))).status === 403);
        check('guest → 401', (await (await request.newContext({ baseURL: URL.API })).get('/documents')).status() === 401);

        const a = await upload(ad, `Catering_Guide_${t}.txt`, `# Catering\n\n${PARA(t)}\n\n${PARA('more')}`);
        check('upload → 201 ready (processed in the request), title from the file name', a.status === 201 && a.j.document.status === 'ready' && a.j.document.title === `Catering Guide ${t}` && a.j.document.chunkCount >= 1 && a.j.document.servingVersion === 1);
        check('new uploads are drafts', a.j.document.isPublished === false);
        check('same file again → 409 naming the existing document', (await upload(ad, 'copy.txt', `# Catering\n\n${PARA(t)}\n\n${PARA('more')}`)).j.message?.includes(`Catering Guide ${t}`));
        const big = await ad.post('/documents', { multipart: file('big.txt', Buffer.alloc(11 * 1024 * 1024, 65)) });
        check('over 10 MB → 413 with a friendly message', big.status() === 413 && /under 10 MB/.test((await big.json()).message));
        const bad = await upload(ad, 'virus.docx', Buffer.from('MZ\x90\x00binary\x00\x01'));
        check('wrong file type → stored as failed with a friendly reason (no 500)', bad.status === 201 && bad.j.document.status === 'failed' && /Use a PDF, Word/.test(bad.j.document.error));
        const docx = await Packer.toBuffer(new Docx({ sections: [{ children: [new Paragraph(PARA(`docx ${t}`))] }] }));
        const w = await upload(ad, 'Events.docx', docx, { title: `Events ${t}` });
        check('DOCX upload with a custom title', w.status === 201 && w.j.document.status === 'ready' && w.j.document.title === `Events ${t}` && w.j.document.mime.includes('wordprocessingml'));
        check('no file → 400', (await ad.post('/documents', { multipart: { title: 'x' } })).status() === 400);

        // publish rules
        const id = a.j.document._id;
        check('publish a ready document → 200', (await ad.put(`/documents/${id}`, { data: { isPublished: true } })).status() === 200);
        const pii = await upload(ad, 'staff.txt', `${PARA(`staff ${t}`)}\nCall Ali on +92 300 1234567 or ali@example.com`);
        const piiId = pii.j.document._id;
        const noConfirm = await ad.put(`/documents/${piiId}`, { data: { isPublished: true } });
        check('privacy flags → publishing needs confirmation (409)', noConfirm.status() === 409 && (await noConfirm.json()).needsConfirmation === true);
        check('with confirmPrivacy → published', (await ad.put(`/documents/${piiId}`, { data: { isPublished: true, confirmPrivacy: true } })).status() === 200);
        check('a failed document cannot be published (409)', (await ad.put(`/documents/${bad.j.document._id}`, { data: { isPublished: true } })).status() === 409);
        check('rename cleans the title', (await (await ad.put(`/documents/${id}`, { data: { title: '  New <b>Title</b> ' } })).json()).document.title === 'New Title');

        // replace keeps title + published; failed replace keeps the old version serving
        const rep = await ad.post(`/documents/${id}/replace`, { multipart: file('v2.txt', `# Catering v2\n\n${PARA(`v2 ${t}`)}`) });
        const rj = (await rep.json()).document;
        check('replace → new version serving, title and published kept', rep.status() === 200 && rj.servingVersion === 2 && rj.isPublished === true && rj.title === 'New Title');
        const failRep = await ad.post(`/documents/${id}/replace`, { multipart: file('broken.pdf', Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('junk '.repeat(100))])) });
        const fj = (await failRep.json()).document;
        check('a broken replacement keeps version 2 answering, with the reason shown', fj.status === 'ready' && fj.servingVersion === 2 && /couldn't be used/.test(fj.error) && (await DocChunk.countDocuments({ documentId: id, version: 2 })) > 0);

        const list = await (await ad.get('/documents')).json();
        check('list shows documents and the limits', list.documents.some((d) => d._id === id) && list.limits.maxDocs === 50 && list.limits.maxFileMb === 10 && typeof list.limits.passages === 'number');
        const one = await (await ad.get(`/documents/${id}`)).json();
        check('detail shows a preview, never vectors', one.preview.length >= 1 && !JSON.stringify(one).includes('embedding'));
        const ri = await (await ad.post(`/documents/${id}/reindex`)).json();
        check('re-index of an unchanged document is free', ri.embedded === 0);

        // duplicate race (the 50-document cap is checked by the same count query; see routes/documents.js)
        const race = await Promise.all([1, 2].map(() => upload(ad, 'race.txt', PARA(`race ${t}`))));
        check('two uploads of the same file at once → exactly one accepted', race.filter((r) => r.status === 201).length === 1 && race.filter((r) => r.status === 409).length === 1);

        // upload limit: keep uploading tiny files until the hourly limit answers
        let limited = false;
        for (let i = 0; i < 25 && !limited; i++) limited = (await upload(ad, `n${i}.txt`, PARA(`limit ${t} ${i}`))).status === 429;
        check('more than 20 uploads an hour → 429', limited);

        // delete
        check('delete → 200 and passages gone', (await ad.delete(`/documents/${id}`)).status() === 200 && (await DocChunk.countDocuments({ documentId: id })) === 0);
        check('delete again → 404', (await ad.delete(`/documents/${id}`)).status() === 404);
        await new Promise((r) => setTimeout(r, 400));
        const audit = await AuditLog.find({ entity: 'document', at: { $gte: since } }).lean();
        check('activity log records document changes', audit.some((x) => x.action === 'create') && audit.some((x) => x.action === 'delete') && audit.some((x) => x.action === 'update'));
    } finally {
        for (const id of created) {
            await DocChunk.deleteMany({ documentId: id });
            await Document.deleteOne({ _id: id });
        }
        await Admin.deleteMany({ _id: { $in: [ed._id, mgr._id] } });
        await AuditLog.deleteMany({ entity: 'document', at: { $gte: since } });
    }
    await done();
})();
