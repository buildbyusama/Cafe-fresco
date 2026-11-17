// RAG R5.2: chat latency added by documents (mock) and a ~200-page sync ingest (mock + real embeddings when RAG_PERF_REAL=1)
const REAL = process.env.RAG_PERF_REAL === '1';
process.env.AI_MOCK = 'true';
const { model, backend, check, connect, done, tag } = require('./lib');

(async () => {
    await connect();
    const [Document, DocChunk, ChatSession, ChatMessage] = ['document', 'docChunk', 'chatSession', 'chatMessage'].map(model);
    const { ingest } = backend('services/rag/ingest');
    const { changed } = backend('services/rag/documents');
    const { handleMessage } = backend('services/ai/chat');
    const t = tag();
    const made = [];
    const sessions = [];
    const guest = { userId: null, anonId: 'p'.repeat(32), userName: null, reqId: 'rag52' };
    const p95 = (a) => a.sort((x, y) => x - y)[Math.floor(a.length * 0.95) - 1];
    const timeAsk = async (q) => {
        const s = process.hrtime.bigint();
        const r = await handleMessage({ text: q, ctx: guest, emit: () => {} });
        sessions.push(r.sessionId);
        return Number(process.hrtime.bigint() - s) / 1e6;
    };
    const QS = ['Do you cater weddings?', 'Is there parking near the cafe?', 'Can I book the party hall for a birthday?', 'Do you do office lunch orders?'];
    try {
        // chat latency without and with a published library
        for (const q of QS) await timeAsk(q); // warm up
        const before = [];
        for (let i = 0; i < 5; i++) for (const q of QS) before.push(await timeAsk(q));
        const page = (n) => `# Section ${n}\n\nWedding catering, birthday parties in the party hall, office lunch boxes and parking rules, part ${n}. Book seven days ahead. ` + 'Guests are welcome and our team helps with setup and decorations for every event. '.repeat(22);
        const big = Array.from({ length: 200 }, (_, i) => page(i)).join('\n\n');
        const d = await Document.create({ title: `Perf Guide ${t}`, mime: 'text/plain', sha256: `${t}-perf` });
        made.push(d._id);
        let s = Date.now();
        const r = await ingest(d._id, Buffer.from(big), 'guide.txt');
        const mockIngest = Date.now() - s;
        await Document.updateOne({ _id: d._id }, { isPublished: true });
        changed();
        await timeAsk(QS[0]); // loads the cache
        const after = [];
        for (let i = 0; i < 5; i++) for (const q of QS) after.push(await timeAsk(q));
        const added = p95(after) - p95(before);
        console.log(`chat p95 without docs ${p95(before).toFixed(0)} ms, with docs ${p95(after).toFixed(0)} ms (+${added.toFixed(0)} ms); 200-page ingest (mock) ${mockIngest} ms, ${r.chunkCount} passages, ${big.length} chars`);
        check('the 200-page document is ready', r.status === 'ready', r.error);
        check('documents add under 300 ms to chat p95 (mock)', added < 300, `${added.toFixed(0)} ms`);
        check('a 200-page ingest (mock embeddings) takes under 10 s', mockIngest < 10000, `${mockIngest} ms`);

        if (REAL) {
            // the real embedding calls are the slow part: run a fresh document through the real model
            delete process.env.AI_MOCK;
            for (const k of Object.keys(require.cache)) if (k.includes('cafeFresco-backend') && !k.includes('node_modules') && !k.includes('models')) delete require.cache[k];
            const real = backend('services/rag/ingest');
            const d2 = await Document.create({ title: `Perf Real ${t}`, mime: 'text/plain', sha256: `${t}-perf-real` });
            made.push(d2._id);
            s = Date.now();
            const r2 = await real.ingest(d2._id, Buffer.from(big.replace(/part (\d+)/g, 'chapter $1')), 'guide.txt');
            const realMs = Date.now() - s;
            console.log(`200-page ingest (real embeddings) ${realMs} ms, ${r2.chunkCount} passages`);
            check('a 200-page ingest with real embeddings fits a 60 s Vercel function', r2.status === 'ready' && realMs < 60000, `${realMs} ms ${r2.error || ''}`);
        }
    } finally {
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
        await ChatMessage.deleteMany({ sessionId: { $in: sessions } });
        await ChatSession.deleteMany({ _id: { $in: sessions } });
        backend('services/rag/retrieve').bust();
    }
    await done();
})();
