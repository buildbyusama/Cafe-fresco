// RAG R1.1: document + passage models (validation, duplicates, cascade delete, hidden vectors, stale, indexes)
const { model, backend, check, connect, done, tag, mongoose } = require('./lib');
(async () => {
    await connect();
    const Document = model('document');
    const DocChunk = model('docChunk');
    await Document.init();
    await DocChunk.init();
    const { deleteDocument, failStale, STALE_MS } = backend('services/rag/documents');
    const t = tag();
    const base = { mime: 'text/plain', sha256: `sha-${t}` };
    const ids = [];
    try {
        let err = null;
        try { await Document.create({ ...base, title: 'x' }); } catch (e) { err = e; }
        check('title under 2 chars rejected', err?.name === 'ValidationError');
        err = null;
        try { await Document.create({ ...base, title: 'Bad type', mime: 'application/zip', sha256: `z-${t}` }); } catch (e) { err = e; }
        check('unsupported type rejected', err?.name === 'ValidationError');
        const d = await Document.create({ ...base, title: '  Catering\u0000 <Guide>  ' + 'x'.repeat(100) });
        ids.push(d._id);
        check('title cleaned (control chars, < >) and cut to 80', !/[<>\u0000]/.test(d.title) && d.title.length === 80 && d.title.startsWith('Catering'));
        check('new documents are processing drafts, version 1', d.status === 'processing' && d.isPublished === false && d.version === 1);
        err = null;
        try { await Document.create({ ...base, title: 'Same file' }); } catch (e) { err = e; }
        check('same file twice → duplicate key', err?.code === 11000);

        await DocChunk.insertMany([0, 1, 2].map((order) => ({ documentId: d._id, version: 1, order, text: `passage ${order}`, embedding: [0.1, 0.2] })));
        const c = await DocChunk.findOne({ documentId: d._id }).lean();
        check('embedding hidden by default', !('embedding' in c));
        await deleteDocument(d._id);
        check('delete removes the document and its passages', !(await Document.findById(d._id)) && (await DocChunk.countDocuments({ documentId: d._id })) === 0);
        await deleteDocument(d._id);
        check('delete is safe to repeat', true);
        const again = await Document.create({ ...base, title: 'Same file again' });
        ids.push(again._id);
        check('after deleting, the same file can be uploaded again', !!again._id);

        const stuck = await Document.create({ ...base, sha256: `s-${t}`, title: 'Stuck doc', processingStartedAt: new Date(Date.now() - STALE_MS - 1000) });
        const fresh = await Document.create({ ...base, sha256: `f-${t}`, title: 'Fresh doc' });
        ids.push(stuck._id, fresh._id);
        await failStale();
        check('stuck processing (> 10 min) → failed with a reason; fresh untouched', (await Document.findById(stuck._id)).status === 'failed' && /interrupted/.test((await Document.findById(stuck._id)).error) && (await Document.findById(fresh._id)).status === 'processing');

        const idx = await DocChunk.collection.indexes();
        check('passage index {documentId, version, order}', idx.some((i) => i.key.documentId === 1 && i.key.version === 1 && i.key.order === 1));
        check('sha256 unique index', (await Document.collection.indexes()).some((i) => i.key.sha256 === 1 && i.unique));
    } finally {
        await DocChunk.deleteMany({ documentId: { $in: ids } });
        await Document.deleteMany({ _id: { $in: ids } });
        await Document.deleteMany({ sha256: new RegExp(t) });
    }
    await done();
})();
