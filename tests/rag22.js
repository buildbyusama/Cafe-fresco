// RAG R2.2: retrieval (ranking, unrelated → nothing, drafts/failed/old versions hidden, ≤2 per doc, context budget,
// keyword fallback, cache reset on changes, 20k-passage speed and memory)
process.env.AI_MOCK = 'true';
// a real garbage collection before and after loading, so the memory figure is the cache and not leftover garbage
require('v8').setFlagsFromString('--expose-gc');
const gc = require('vm').runInNewContext('gc');
const { request } = require('playwright');
const { model, backend, URL, ADMIN, check, connect, done, tag } = require('./lib');

(async () => {
    await connect();
    const [Document, DocChunk] = ['document', 'docChunk'].map(model);
    const { ingest } = backend('services/rag/ingest');
    const { retrieve, bust, load } = backend('services/rag/retrieve');
    const { changed } = backend('services/rag/documents');
    const t = tag();
    const mem = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; }; // Float32Array data lives outside the JS heap
    const made = [];
    let seq = 0;
    const add = async (title, text, { publish = true } = {}) => {
        const d = await Document.create({ title, mime: 'text/plain', sha256: `${t}-r22-${seq++}` });
        made.push(d._id);
        await ingest(d._id, Buffer.from(text), `${title}.txt`);
        if (publish) await Document.updateOne({ _id: d._id }, { isPublished: true });
        changed();
        return d._id;
    };
    const top = async (q) => (await retrieve(q)).passages;
    try {
        const catering = await add(`Catering Guide ${t}`, `# Catering packages\n\nCatering for weddings and office events needs seven days notice. A catering deposit of 30 percent confirms the booking. Catering staff arrive two hours early to set up the buffet.\n\n# Catering menus\n\nCatering menus are planned with each client; vegetarian catering platters are available on request.`);
        const events = await add(`Events ${t}`, `# Birthday parties\n\nThe party hall seats forty guests. Birthday party bookings include balloons, a cake table and a music system. Parties end by eleven at night.`);
        await add(`Old Menu ${t}`, `# Old menu 2021\n\nZinger burger 350 rupees. Club sandwich 290 rupees. These old prices are no longer valid.`);
        const urdu = await add(`Urdu Policy ${t}`, `# واپسی کی پالیسی\n\nاگر کھانا خراب ہو تو ایک گھنٹے کے اندر رابطہ کریں، ہم پیسے واپس کریں گے یا نیا کھانا بھیجیں گے۔`);
        const draft = await add(`Secret Draft ${t}`, `# Zebra staff bonus\n\nZebra bonus plan for the zebra team, confidential.`, { publish: false });

        const c = await top('How many days notice do you need for wedding catering?');
        check('the right document ranks first', c[0]?.source === `Catering Guide ${t}`);
        check('passages carry source, heading, text and score', c[0] && c[0].heading && c[0].text && typeof c[0].score === 'number');
        check('birthday question → events document first', (await top('birthday party hall guests'))[0]?.source === `Events ${t}`);
        check('an unrelated question returns nothing', (await top('quantum physics telescope astronomy')).length === 0);
        check('drafts never appear', !(await top('zebra bonus plan')).some((p) => p.source.includes('Secret Draft')));
        const ur = await top('واپسی پالیسی کھانا خراب');
        check('Urdu question → Urdu document', ur[0]?.source === `Urdu Policy ${t}`);
        const cross = await top('refund policy for spoiled food');
        console.log(`      (cross-language: English question → Urdu document ${cross.some((p) => p.source.includes('Urdu')) ? 'found' : 'not found'} in test mode; see PERFORMANCE.md)`);

        // failed and older-version passages
        await Document.updateOne({ _id: events }, { status: 'failed' });
        changed();
        check('failed documents never appear', !(await top('birthday party hall guests')).some((p) => p.source === `Events ${t}`));
        await Document.updateOne({ _id: events }, { status: 'ready' });
        await DocChunk.create({ documentId: catering, version: 99, order: 0, text: 'Catering for weddings needs ninety nine days notice (old version text).', chars: 70 });
        changed();
        check('passages of other versions never appear', !(await top('wedding catering notice days')).some((p) => p.text.includes('ninety nine')));

        // limits
        const many = await retrieve('catering catering menus deposit staff buffet vegetarian weddings');
        const counts = many.passages.reduce((m, p) => ({ ...m, [p.source]: (m[p.source] || 0) + 1 }), {});
        check('at most 2 passages per document', Object.values(counts).every((n) => n <= 2));
        check('context budget holds (≤ 3,500 chars) and ≤ 5 passages', many.passages.reduce((s, p) => s + p.text.length, 0) <= 3500 && many.passages.length <= 5);

        // cache reset on unpublish / delete
        await top('birthday party hall guests');
        await Document.updateOne({ _id: events }, { isPublished: false });
        changed();
        check('unpublish takes effect at once (cache cleared)', !(await top('birthday party hall guests')).some((p) => p.source === `Events ${t}`));

        // keyword fallback (no AI)
        const key = process.env.OPENAI_API_KEY;
        process.env.AI_MOCK = 'false';
        process.env.OPENAI_API_KEY = '';
        const kw = await retrieve('catering deposit booking');
        check('no AI → keyword search still finds the document', kw.mode === 'keyword' && kw.passages[0]?.source === `Catering Guide ${t}`);
        check('no AI → unrelated question returns nothing', (await retrieve('telescope astronomy')).passages.length === 0);
        process.env.OPENAI_API_KEY = key || '';
        process.env.AI_MOCK = 'true';

        // the dashboard's "Ask your documents" box
        const ad = await request.newContext({ baseURL: URL.API });
        await ad.post('/admin/login', { data: ADMIN });
        const api = await ad.post('/documents/test', { data: { question: 'wedding catering notice' } });
        const aj = await api.json();
        check('POST /documents/test answers with passages and the mode', api.status() === 200 && Array.isArray(aj.passages) && ['semantic', 'keyword', 'none'].includes(aj.mode));
        check('empty question → 400; guests → 401', (await ad.post('/documents/test', { data: { question: '' } })).status() === 400 && (await (await request.newContext({ baseURL: URL.API })).post('/documents/test', { data: { question: 'hi there' } })).status() === 401);

        // 20,000 synthetic passages: speed and memory
        const big = await Document.create({ title: `Synthetic ${t}`, mime: 'text/plain', sha256: `${t}-r22-big`, status: 'ready', isPublished: true, servingVersion: 1 });
        made.push(big._id);
        const rnd = () => Array.from({ length: 512 }, () => Math.random() - 0.5);
        for (let i = 0; i < 20000; i += 2000) {
            await DocChunk.insertMany(Array.from({ length: 2000 }, (_, j) => ({ documentId: big._id, version: 1, order: i + j, text: `Synthetic passage ${i + j} about storage shelves and pallets.`, chars: 50, embedding: rnd() })), { lean: true });
        }
        bust();
        gc();
        const before = mem();
        const loaded = await load();
        gc();
        const heapMb = (mem() - before) / 1048576;
        const times = [];
        for (let i = 0; i < 40; i++) {
            const s = process.hrtime.bigint();
            await retrieve(`wedding catering notice ${i % 4}`);
            times.push(Number(process.hrtime.bigint() - s) / 1e6);
        }
        times.sort((a, b) => a - b);
        const p95 = times[Math.floor(times.length * 0.95)];
        console.log(`      (${loaded.length} passages, vectors ${(loaded.vectorBytes / 1048576).toFixed(1)} MB, whole cache +${heapMb.toFixed(1)} MB, p50 ${times[20].toFixed(1)} ms, p95 ${p95.toFixed(1)} ms)`);
        check('p95 under 100 ms with 20,000 passages', p95 < 100);
        check('vectors take under 60 MB', loaded.vectorBytes / 1048576 < 60);
        check('the whole search cache (vectors, text, keywords) stays under 100 MB', heapMb < 100);
    } finally {
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
        bust();
    }
    await done();
})();
