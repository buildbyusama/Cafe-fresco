// RAG R1.2: text extraction (types by content, scanned / encrypted / broken PDFs, DOCX zip bomb, Urdu, privacy scan, worker)
const PDF = require('pdfkit');
const JSZip = require('jszip');
const { Document, Packer, Paragraph, HeadingLevel } = require('docx');
const { backend, check, done } = require('./lib');

const pdfOf = (fill, opts = {}) => new Promise((res) => {
    const d = new PDF(opts);
    const b = [];
    d.on('data', (x) => b.push(x));
    d.on('end', () => res(Buffer.concat(b)));
    fill(d);
    d.end();
});
const LONG = 'Cafe Fresco caters weddings, birthdays and office lunches for 20 to 300 guests. Book at least seven days ahead. ';

(async () => {
    const { extract, ExtractError } = backend('services/rag/extract');
    const fails = async (buf, name, re) => {
        try { await extract(buf, name); return false; } catch (e) { return e instanceof ExtractError && re.test(e.message) && !/\bat \w+ \(|[A-Z]:\\|\/node_modules\//.test(e.message); }
    };

    const textPdf = await pdfOf((d) => { d.text('CATERING GUIDE'); d.text(LONG.repeat(3)); d.addPage(); d.text('Page two: delivery is free within the city.'); });
    const r1 = await extract(textPdf, 'guide.pdf');
    check('text PDF → text, 2 pages, page markers removed', /caters weddings/.test(r1.text) && /Page two/.test(r1.text) && r1.pages === 2 && !/-- \d+ of \d+ --/.test(r1.text) && r1.mime === 'application/pdf');

    const scanned = await pdfOf((d) => { d.rect(50, 50, 300, 300).fill('#e8262b'); });
    check('image-only PDF → "scanned PDF" message', await fails(scanned, 'scan.pdf', /scanned PDF/));

    const locked = await pdfOf((d) => d.text(LONG), { userPassword: 'secret', ownerPassword: 'owner' });
    check('password-protected PDF → friendly message', await fails(locked, 'locked.pdf', /password-protected/));

    const broken = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('garbage '.repeat(200))]);
    check('broken PDF → "damaged" message, no crash', await fails(broken, 'broken.pdf', /couldn't be read|damaged/));

    const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ text: 'Events', heading: HeadingLevel.HEADING_1 }), new Paragraph(LONG)] }] }));
    const r2 = await extract(docx, 'events.docx');
    check('DOCX → text', /Events/.test(r2.text) && /caters weddings/.test(r2.text) && r2.mime.includes('wordprocessingml'));

    // zip bomb: a real .docx structure plus one entry that unpacks to 60 MB
    const bomb = new JSZip();
    bomb.file('[Content_Types].xml', '<Types/>');
    bomb.file('word/document.xml', '<w:document/>');
    bomb.file('word/media/huge.bin', Buffer.alloc(60 * 1024 * 1024));
    const bombBuf = await bomb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    check(`DOCX zip bomb (${Math.round(bombBuf.length / 1024)} KB → 60 MB) refused before unpacking`, await fails(bombBuf, 'bomb.docx', /unusually large/));

    const plainZip = new JSZip();
    plainZip.file('a.txt', 'hello');
    check('a zip that is not a Word file → type message', await fails(await plainZip.generateAsync({ type: 'nodebuffer' }), 'x.docx', /Use a PDF, Word/));
    check('an EXE renamed .docx → type message', await fails(Buffer.from('MZ\x90\x00\x03\x00\x00\x00binary\x00stuff'), 'virus.docx', /Use a PDF, Word/));
    check('a text file renamed .pdf is read as text (content decides)', (await extract(Buffer.from(LONG), 'fake.pdf')).mime === 'text/plain');
    const md = await extract(Buffer.from(`# Opening times\n\nہم روزانہ صبح گیارہ بجے کھلتے ہیں۔\n\n${LONG}`, 'utf8'), 'notes.md');
    check('Markdown with Urdu survives intact', md.mime === 'text/markdown' && /روزانہ/.test(md.text) && /# Opening times/.test(md.text));
    check('invalid UTF-8 → type message', await fails(Buffer.from([0xc3, 0x28, 0xa0, 0xa1, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51]), 'x.txt', /Use a PDF, Word/));
    check('almost empty file → "no text" message', await fails(Buffer.from('hi'), 'x.txt', /almost no text/));
    check('over ~200 pages → split message', await fails(Buffer.from('x'.repeat(400001)), 'huge.txt', /over about 200 pages/));

    const pii = await extract(Buffer.from(`${LONG}\nContact Ali at ali.khan@example.com or +92 300 1234567. CNIC 35202-1234567-1. Card 4242 4242 4242 4242.`), 'staff.txt');
    const flag = (t) => pii.privacyFlags.find((f) => f.type === t)?.count || 0;
    check('privacy scan counts email, phone, CNIC, card-like numbers', flag('email') === 1 && flag('phone') >= 1 && flag('CNIC') === 1 && flag('card-like number') >= 1, JSON.stringify(pii.privacyFlags));
    check('a clean document has no privacy flags', r1.privacyFlags.length === 0);

    // the server keeps responding while a PDF parses in its worker
    const big = await pdfOf((d) => { for (let i = 0; i < 120; i++) { d.text(LONG.repeat(6)); d.addPage(); } });
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    const s = Date.now();
    const rb = await extract(big, 'big.pdf');
    clearInterval(timer);
    const ms = Date.now() - s;
    check(`a ${rb.pages}-page PDF parses off the main thread (${ms} ms, event loop kept ticking)`, rb.pages >= 120 && ticks >= Math.floor(ms / 10) * 0.5, `${ticks} ticks in ${ms} ms`);
    await done();
})();
