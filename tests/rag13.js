// RAG R1.3: chunking + ingest pipeline (sizes/overlap/headings, ready/failed, races, budget, caps, keyword-only, concurrency)
process.env.AI_MOCK = 'true';
const { model, backend, check, connect, done, tag } = require('./lib');
const PARA = (n) => `Paragraph ${n}: Cafe Fresco prepares fresh food every morning, and our catering team plans menus with each client so the event runs smoothly from start to finish.`;

(async () => {
    await connect();
    const Document = model('document');
    const DocChunk = model('docChunk');
    const { chunk, headingOf } = backend('services/rag/chunk');
    const { ingest, reindex } = backend('services/rag/ingest');
    const t = tag();
    const made = [];
    let seq = 0;
    const newDoc = async (title, extra = {}) => {
        const d = await Document.create({ title, mime: 'text/plain', sha256: `${t}-${seq++}`, ...extra });
        made.push(d._id);
        return d;
    };
    try {
        // chunking
        const text = `# Catering\n\n${Array.from({ length: 12 }, (_, i) => PARA(i)).join('\n\n')}\n\nEVENTS AND PARTIES\n\n${Array.from({ length: 6 }, (_, i) => PARA(100 + i)).join('\n\n')}\n\n${'longword '.repeat(400)}`;
        const parts = chunk(text);
        check('passages are ≤ 1200 chars and never empty', parts.every((p) => p.chars <= 1200 && p.chars >= 40));
        check('headings carried (Markdown and ALL-CAPS)', parts[0].heading === 'Catering' && parts.some((p) => p.heading === 'EVENTS AND PARTIES'));
        const sameSection = parts.filter((p) => p.heading === 'Catering');
        const overlapOk = sameSection.slice(1).every((p, i) => { const prevEnd = sameSection[i].text.slice(-60); return p.text.includes(prevEnd.slice(prevEnd.indexOf(' ') + 1, prevEnd.indexOf(' ') + 30)); });
        check('consecutive passages in a section overlap', sameSection.length > 1 && overlapOk);
        check('no word is cut in half', parts.every((p) => !/\blongwor\b|\blongw\b/.test(p.text)));
        check('heading detection ignores normal sentences', headingOf('We open at 9.') === null && headingOf('2. Delivery Areas') === '2. Delivery Areas');
        const hundredPages = chunk(Array.from({ length: 2000 }, (_, i) => PARA(i)).join('\n\n'));
        check(`~100 pages → a sensible number of passages (${hundredPages.length})`, hundredPages.length > 200 && hundredPages.length < 400);

        // ingest: processing → ready
        const d1 = await newDoc('Catering Guide');
        const r1 = await ingest(d1._id, Buffer.from(text), 'guide.txt');
        const chunks1 = await DocChunk.find({ documentId: d1._id }).select('+embedding').lean();
        check('ingest → ready with counts and 512-number vectors', r1.status === 'ready' && r1.chunkCount === chunks1.length && chunks1.every((c) => c.embedding.length === 512) && r1.chars > 1000);
        const again = await reindex(d1._id);
        check('re-index of an unchanged document embeds nothing', again.embedded === 0 && again.skipped === chunks1.length);

        // failure leaves nothing behind
        const d2 = await newDoc('Bad file');
        const r2 = await ingest(d2._id, Buffer.from('MZ\x00\x01binary'), 'x.exe');
        check('bad file → failed with a friendly reason, no passages', r2.status === 'failed' && /Use a PDF/.test(r2.error) && (await DocChunk.countDocuments({ documentId: d2._id })) === 0);

        // delete during ingest → no orphan passages
        const d3 = await newDoc('Deleted mid-way');
        const p3 = ingest(d3._id, Buffer.from(text), 'g.txt');
        await backend('services/rag/documents').deleteDocument(d3._id);
        await p3;
        await new Promise((r) => setTimeout(r, 200));
        check('delete during processing leaves 0 orphan passages', (await DocChunk.countDocuments({ documentId: d3._id })) === 0 && !(await Document.findById(d3._id)));

        // replace during ingest → only the newest version survives
        const d4 = await newDoc('Replaced mid-way');
        const old = ingest(d4._id, Buffer.from(`${text}\n\nOLD VERSION TEXT here for testing.`), 'v1.txt');
        await Document.updateOne({ _id: d4._id }, { $inc: { version: 1 }, $set: { status: 'processing', processingStartedAt: new Date() } });
        const fresh = ingest(d4._id, Buffer.from(`# New\n\n${PARA(1)}\n\nNEW VERSION TEXT here for testing.`), 'v2.txt');
        await Promise.all([old, fresh]);
        const v = await Document.findById(d4._id);
        const texts = (await DocChunk.find({ documentId: d4._id }).lean()).map((c) => c.text).join(' ');
        check('replace during processing: only version 2 remains', v.status === 'ready' && v.version === 2 && /NEW VERSION/.test(texts) && !/OLD VERSION/.test(texts));

        // a failed replace keeps the previous version serving
        await Document.updateOne({ _id: d4._id }, { $inc: { version: 1 }, $set: { status: 'processing' } });
        const failedReplace = await ingest(d4._id, Buffer.from('hi'), 'tiny.txt');
        check('failed replace → previous version still ready and searchable', failedReplace.status === 'ready' && failedReplace.version === 2 && /couldn't be used/.test(failedReplace.error) && (await DocChunk.countDocuments({ documentId: d4._id, version: 2 })) > 0);

        // budget guard (R9)
        process.env.AI_DAILY_TOKEN_BUDGET = '1000';
        const d5 = await newDoc('Too big for budget');
        const r5 = await ingest(d5._id, Buffer.from(Array.from({ length: 60 }, (_, i) => PARA(i)).join('\n\n')), 'big.txt');
        check('over half the remaining daily budget → refused with a clear message', r5.status === 'failed' && /remaining AI budget/.test(r5.error));
        process.env.AI_DAILY_TOKEN_BUDGET = '2000000';

        // library-wide passage cap
        process.env.RAG_MAX_PASSAGES = '3';
        const d6 = await newDoc('Library full');
        const r6 = await backend('services/rag/ingest').ingest(d6._id, Buffer.from(text), 'g.txt');
        delete process.env.RAG_MAX_PASSAGES;
        check('total passage cap → "library is full"', r6.status === 'failed' && /library is full/.test(r6.error));

        // AI off → keyword-only, re-index later adds vectors
        process.env.AI_MOCK = 'false';
        const key = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = '';
        const d7 = await newDoc('No AI yet');
        const r7 = await ingest(d7._id, Buffer.from(text), 'g.txt');
        const noVec = await DocChunk.findOne({ documentId: d7._id }).select('+embedding').lean();
        check('without AI: ready, keyword-only note, no vectors', r7.status === 'ready' && /keywords only/.test(r7.error) && !noVec.embedding?.length);
        process.env.OPENAI_API_KEY = key || '';
        process.env.AI_MOCK = 'true';
        const ri = await reindex(d7._id);
        check('re-index once AI is on → vectors added, note cleared', ri.embedded > 0 && !(await Document.findById(d7._id)).error);

        // at most 2 ingests run at once
        const docs = await Promise.all([1, 2, 3, 4].map((i) => newDoc(`Parallel ${i}`)));
        let peak = 0;
        const ext = backend('services/rag/extract');
        const real = ext.extract;
        let inFlight = 0;
        ext.extract = async (...a) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 150)); try { return await real(...a); } finally { inFlight--; } };
        delete require.cache[require.resolve('../cafeFresco-backend/services/rag/ingest')];
        const fresh2 = backend('services/rag/ingest');
        await Promise.all(docs.map((d) => fresh2.ingest(d._id, Buffer.from(text), 'g.txt')));
        ext.extract = real;
        check('no more than 2 ingests run at the same time', peak <= 2, `peak ${peak}`);
    } finally {
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
    }
    await done();
})();
