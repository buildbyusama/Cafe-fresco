// RAG R5.3 audit pass 1 (logic and data): interrupted ingests, delete / replace while processing, version cleanup, cache.
process.env.AI_MOCK = 'true';
const { model, backend, check, connect, done, tag } = require('./lib');

(async () => {
    await connect();
    const [Document, DocChunk] = ['document', 'docChunk'].map(model);
    const { ingest } = backend('services/rag/ingest');
    const { failStale, deleteDocument, changed, STALE_MS } = backend('services/rag/documents');
    const { retrieve, bust } = backend('services/rag/retrieve');
    const t = tag();
    const made = [];
    let seq = 0;
    const text = (w) => Buffer.from(`# ${w}\n\n${`The ${w} ${t} service needs three days notice and our team arranges everything for the guests. `.repeat(6)}`);
    const newDoc = async (title) => {
        const d = await Document.create({ title, mime: 'text/plain', sha256: `${t}-a1-${seq++}` });
        made.push(d._id);
        return d;
    };
    const old = new Date(Date.now() - STALE_MS - 60000);
    try {
        // 1. interrupted replace: the previous version keeps serving and stays searchable
        const a = await newDoc(`Audit Catering ${t}`);
        await ingest(a._id, text('catering'), 'a.txt');
        await Document.updateOne({ _id: a._id }, { isPublished: true });
        changed();
        await Document.updateOne({ _id: a._id }, { $inc: { version: 1 }, $set: { status: 'processing', processingStartedAt: old } });
        await DocChunk.create({ documentId: a._id, version: 2, order: 0, text: 'half written passage of the new file', heading: '' });
        const n = await failStale();
        const a2 = await Document.findById(a._id).lean();
        check('interrupted replace → back to ready on the serving version', n >= 1 && a2.status === 'ready' && a2.version === 1 && a2.servingVersion === 1 && /previous version is still in use/.test(a2.error), JSON.stringify({ s: a2.status, v: a2.version, e: a2.error }));
        check("the abandoned version's passages are removed", (await DocChunk.countDocuments({ documentId: a._id, version: 2 })) === 0 && (await DocChunk.countDocuments({ documentId: a._id, version: 1 })) > 0);
        check('…and the document still answers', (await retrieve(`catering ${t} service notice`)).passages.some((p) => p.source === `Audit Catering ${t}`));

        // 2. interrupted first upload → failed with a friendly reason
        const b = await newDoc(`Audit Fresh ${t}`);
        await Document.updateOne({ _id: b._id }, { processingStartedAt: old });
        await failStale();
        const b2 = await Document.findById(b._id).lean();
        check('interrupted first upload → failed, "upload again"', b2.status === 'failed' && /Upload the file again/.test(b2.error));
        check('a recent upload is not touched by the stale check', (await (async () => { const c = await newDoc(`Audit Recent ${t}`); await failStale(); return (await Document.findById(c._id).lean()).status; })()) === 'processing');

        // 3. delete while processing: no passages left, nothing resurrected
        const d = await newDoc(`Audit Delete ${t}`);
        const running = ingest(d._id, text('deleted'), 'd.txt');
        await deleteDocument(d._id);
        const r = await running;
        check('delete during ingest → document and passages gone', !r && !(await Document.exists({ _id: d._id })) && (await DocChunk.countDocuments({ documentId: d._id })) === 0);

        // 4. replace overtaken by a newer replace: the older run never marks ready or mixes passages
        const e = await newDoc(`Audit Replace ${t}`);
        await ingest(e._id, text('first'), 'e.txt');
        await Document.updateOne({ _id: e._id }, { $set: { version: 2, status: 'processing' } });
        const slow = ingest(e._id, text('second'), 'e2.txt');
        await Document.updateOne({ _id: e._id }, { $set: { version: 3 } });
        await slow;
        const e2 = await Document.findById(e._id).lean();
        check('an overtaken replace leaves no passages of its version', (await DocChunk.countDocuments({ documentId: e._id, version: 2 })) === 0 && e2.servingVersion === 1);
        await Document.updateOne({ _id: e._id }, { $set: { status: 'processing' } });
        await ingest(e._id, text('third'), 'e3.txt');
        const e3 = await Document.findById(e._id).lean();
        const versions = await DocChunk.distinct('version', { documentId: e._id });
        check('the newest replace serves and older versions retire', e3.status === 'ready' && e3.servingVersion === 3 && versions.length === 1 && versions[0] === 3, JSON.stringify(versions));

        // 6. a failed replace gives the serving file its fingerprint back (duplicate detection stays right)
        const f = await newDoc(`Audit Sha ${t}`);
        await ingest(f._id, text('fingerprint'), 'f.txt');
        const firstSha = (await Document.findById(f._id).lean()).sha256;
        await Document.updateOne({ _id: f._id }, { $inc: { version: 1 }, $set: { status: 'processing', previousSha256: firstSha, sha256: `${t}-broken` } });
        const fr = await ingest(f._id, Buffer.from([0, 1, 2, 3, 0xff, 0, 0, 0, ...Array(64).fill(0)]), 'broken.txt');
        check('failed replace → old version serving, old fingerprint restored', fr.status === 'ready' && fr.servingVersion === 1 && fr.sha256 === firstSha && !fr.previousSha256, JSON.stringify({ s: fr.status, sha: fr.sha256 === firstSha }));
        await Document.updateOne({ _id: f._id }, { $inc: { version: 1 }, $set: { status: 'processing', processingStartedAt: old, previousSha256: firstSha, sha256: `${t}-stuck` } });
        await failStale();
        check('interrupted replace → old fingerprint restored too', (await Document.findById(f._id).lean()).sha256 === firstSha);

        // 5. cache: unpublish takes effect on the next search
        await Document.updateOne({ _id: a._id }, { isPublished: false });
        changed();
        check('unpublishing removes it from search at once', !(await retrieve(`catering ${t} service notice`)).passages.some((p) => p.source === `Audit Catering ${t}`));
    } finally {
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
        bust();
    }
    await done();
})();
