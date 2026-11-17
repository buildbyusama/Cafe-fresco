// RAG R5.3 audit pass 2 (answer quality): 30 real-model questions over realistic documents.
// Needs OPENAI_API_KEY. Saves the transcript to docs/ai-transcripts/rag/audit2.md.
const fs = require('fs');
const path = require('path');
const { model, backend, check, connect, done, tag } = require('./lib');

const GUIDE = `# Catering and events guide

## Weddings
We cater weddings for 50 to 400 guests. Book at least fourteen days ahead. A deposit of thirty percent confirms the date. Our team sets up the buffet two hours before guests arrive and clears up afterwards.

## Birthday parties
The party hall seats up to 40 children. Birthday bookings need two days notice. We provide balloons, a cake table and a host for games.

## Office lunches
We deliver boxed office lunches for teams of 10 or more on weekdays. Order by 10 am for same-day lunch. Each box is labelled with the name of the person.
`;
const POLICY = `# House policies

## Halal
All our meat is halal certified by the Punjab Halal Authority. We do not serve pork or alcohol.

## Parking
Free parking for 30 cars is behind the building. Valet parking is available on Friday and Saturday evenings.

## Kids
High chairs and a small kids corner with crayons are available. Children under five eat free from the kids menu on Sundays.

## Lost items
Lost items are kept at the counter for thirty days.
`;
const STALE = `# Old menu 2022

Chicken Karahi costs $3.00 and the family platter costs $9.00. Prices from 2022.
`;

const QUESTIONS = [
    // grounded in a document → must contain the fact and name the source
    ['How many days ahead do I need to book wedding catering?', /fourteen|14/i, 'Catering'],
    ['What deposit do you need for a wedding?', /thirty|30\s?%|percent/i, 'Catering'],
    ['When does your team set up the wedding buffet?', /two hours|2 hours/i, 'Catering'],
    ['How many kids fit in the party hall?', /40|forty/i, 'Catering'],
    ['What do you provide for birthday parties?', /balloon|host|cake table/i, 'Catering'],
    ['Do you do office lunch delivery?', /10|ten|boxed|box/i, 'Catering'],
    ['By what time must I order office lunch for the same day?', /10\s?(am|a\.m)/i, 'Catering'],
    ['Is your meat halal?', /halal/i, 'Policies'],
    ['Do you serve alcohol?', /no|not|don't/i, 'Policies'],
    ['Where can I park?', /behind|30|thirty/i, 'Policies'],
    ['Is there valet parking?', /friday|saturday|weekend/i, 'Policies'],
    ['Do you have high chairs?', /high chair|yes/i, 'Policies'],
    ['Do kids eat free?', /sunday|under five|under 5/i, 'Policies'],
    ['I left my bag at the cafe yesterday, what happens to lost items?', /counter|thirty days|30 days/i, 'Policies'],
    // languages
    ['کیا آپ کا گوشت حلال ہے؟', /حلال|halal/i, null],
    ['Shaadi ki catering ke liye kitne din pehle booking karni hogi?', /14|fourteen|چودہ|chodah|din/i, null],
    // mixed: database dish + document fact in one answer
    ['Do you cater weddings, and how much is the Chicken Karahi?', /fourteen|14|wedding/i, 'Catering', 'price'],
    ['Is the food halal and what does the family platter cost?', /halal/i, 'Policies', 'price'],
    // stale prices: the database wins, the 2022 figures never appear
    ['How much is Chicken Karahi according to your old menu?', null, null, 'price'],
    ['What did the family platter cost in 2022?', null, null, 'price'],
    // honest "don't know"
    ['Do you have a rooftop swimming pool?', 'dontknow'],
    ['Can I bring my dog inside?', 'dontknow'],
    ['Do you offer cooking classes?', 'dontknow'],
    ['What is the wifi password?', 'dontknow'],
    ['Do you have a helipad for events?', 'dontknow'],
    // store facts stay with the store tools
    ['What are your opening hours?', /\d/, null],
    ['Do you deliver?', /deliver/i, null],
    // follow-ups on the same topic
    ['Can you cater a wedding for 500 guests?', /400|50 to 400|up to 400/i, 'Catering'],
    ['How long do you keep lost items?', /thirty|30/i, 'Policies'],
    ['Do I need to book a birthday party in advance?', /two days|2 days/i, 'Catering'],
];

(async () => {
    if (!process.env.OPENAI_API_KEY) { console.log('needs OPENAI_API_KEY'); process.exit(1); }
    await connect();
    const [Document, DocChunk, Product, Category, Inventory, ChatSession, ChatMessage] = ['document', 'docChunk', 'product', 'category', 'inventory', 'chatSession', 'chatMessage'].map(model);
    const { ingest } = backend('services/rag/ingest');
    const { changed } = backend('services/rag/documents');
    const { handleMessage } = backend('services/ai/chat');
    const t = tag();
    const made = [];
    const sessions = [];
    const log = [];
    const add = async (title, text, i) => {
        const d = await Document.create({ title, mime: 'text/markdown', sha256: `${t}-a2-${i}` });
        made.push(d._id);
        const r = await ingest(d._id, Buffer.from(text), 'doc.md');
        await Document.updateOne({ _id: d._id }, { isPublished: true });
        return r;
    };
    const cat = await Category.create({ title: `Audit Desi ${t}` });
    const karahi = await Product.create({ title: 'Chicken Karahi', description: 'Wok-cooked chicken in tomato and green chilli', price: 11.5, category: cat._id, tags: ['desi'] });
    const platter = await Product.create({ title: 'Family Platter', description: 'Grilled meats, rice and naan for four', price: 24, category: cat._id, tags: ['desi'] });
    await Inventory.create([{ productId: karahi._id, quantityInStock: 20 }, { productId: platter._id, quantityInStock: 20 }]);
    try {
        await add('Catering Guide', GUIDE, 1);
        await add('House Policies', POLICY, 2);
        await add('Old Menu 2022', STALE, 3);
        changed();
        let grounded = 0, cited = 0, honest = 0, prices = 0, nGrounded = 0, nHonest = 0, nPrice = 0;
        for (const [q, expect, source, kind] of QUESTIONS) {
            const r = await handleMessage({ text: q, ctx: { userId: null, anonId: `a2${t}`.padEnd(32, 'x').slice(0, 32), reqId: 'a2' }, emit: () => {} });
            sessions.push(r.sessionId);
            const a = r.content;
            const srcs = (r.cards || []).filter((c) => c.type === 'source').map((c) => c.title);
            const notes = [];
            if (expect === 'dontknow') {
                nHonest++;
                const ok = /don't have|do not have|not sure|no information|couldn't find|don't know|contact/i.test(a) && !srcs.length;
                if (ok) honest++; else notes.push('not an honest "don\'t know"');
            } else {
                if (expect) { nGrounded++; if (expect.test(a)) grounded++; else notes.push('missing the fact'); }
                if (source) { if (srcs.some((s) => s.includes(source)) || a.includes(source)) cited++; else notes.push('source not named'); }
            }
            if (kind === 'price') {
                nPrice++;
                const stale = /\$3\.00|\$9\.00/.test(a);
                const dbOk = !/\$\d/.test(a) || /\$11\.50|\$24(\.00)?/.test(a);
                if (!stale && dbOk) prices++; else notes.push(stale ? 'quoted a stale document price' : 'price not from the database');
            }
            log.push({ q, a, srcs, notes });
            console.log(`${notes.length ? 'WARN' : 'ok  '}  ${q}${notes.length ? `  - ${notes.join('; ')}` : ''}`);
        }
        const nSourced = QUESTIONS.filter((x) => x[2]).length;
        console.log(`\ngrounded ${grounded}/${nGrounded}, cited ${cited}/${nSourced}, honest ${honest}/${nHonest}, database prices ${prices}/${nPrice}`);
        check('the database wins on prices (no stale document price, ever)', prices === nPrice);
        check('honest "don\'t know" for every unknown topic', honest === nHonest);
        check('at least 90% of document answers contain the fact', grounded >= Math.ceil(nGrounded * 0.9), `${grounded}/${nGrounded}`);
        check('at least 90% of document answers name the source', cited >= Math.ceil(nSourced * 0.9), `${cited}/${nSourced}`);
        const dir = path.join(__dirname, '..', 'docs', 'ai-transcripts', 'rag');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'audit2.md'), [`# RAG audit 2: answer quality (real model), ${new Date().toISOString().slice(0, 10)}`, '', `grounded ${grounded}/${nGrounded}, cited ${cited}/${nSourced}, honest ${honest}/${nHonest}, database prices ${prices}/${nPrice}`, '', ...log.flatMap((x) => [`### ${x.q}`, '', x.a, '', `Sources: ${x.srcs.join(', ') || 'none'}${x.notes.length ? ` · **${x.notes.join('; ')}**` : ''}`, ''])].join('\n'));
    } finally {
        await DocChunk.deleteMany({ documentId: { $in: made } });
        await Document.deleteMany({ _id: { $in: made } });
        await Inventory.deleteMany({ productId: { $in: [karahi._id, platter._id] } });
        await Product.deleteMany({ _id: { $in: [karahi._id, platter._id] } });
        await Category.deleteOne({ _id: cat._id });
        await ChatMessage.deleteMany({ sessionId: { $in: sessions } });
        await ChatSession.deleteMany({ _id: { $in: sessions } });
        backend('services/rag/retrieve').bust();
    }
    await done();
})();
