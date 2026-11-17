// RAG R0.1: libraries, config, embed dimensions, per-tool output limit, activity-log mapping
process.env.AI_MOCK = 'true';
const { backend, check, done, connect } = require('./lib');
(async () => {
    await connect();
    const t0 = Date.now();
    const { PDFParse } = require('../cafeFresco-backend/node_modules/pdf-parse');
    const mammoth = require('../cafeFresco-backend/node_modules/mammoth');
    const yauzl = require('../cafeFresco-backend/node_modules/yauzl');
    check('pdf-parse v2, mammoth and yauzl load', typeof PDFParse === 'function' && typeof mammoth.extractRawText === 'function' && typeof yauzl.fromBuffer === 'function');
    check('loading pdf-parse reads no bundled sample file (fast require)', Date.now() - t0 < 5000);

    const PDF = require('pdfkit');
    const pdf = await new Promise((res) => { const d = new PDF(); const b = []; d.on('data', (x) => b.push(x)); d.on('end', () => res(Buffer.concat(b))); d.text('Hello catering'); d.end(); });
    const parser = new PDFParse({ data: pdf, isEvalSupported: false });
    const r = await parser.getText();
    await parser.destroy();
    check('a generated PDF can be read', /Hello catering/.test(r.text) && r.total === 1);
    const { Document, Packer, Paragraph } = require('docx');
    const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Hello word file')] }] }));
    check('a generated DOCX can be read', /Hello word file/.test((await mammoth.extractRawText({ buffer: docx })).value));

    const cfg = backend('config/env').rag();
    check('config defaults', cfg.maxFileMb === 10 && cfg.maxDocs === 50 && cfg.dims === 512 && cfg.ingestMode === 'sync' && cfg.contextChars === 3500);
    process.env.VERCEL = '1';
    check('4 MB default on Vercel', backend('config/env').rag().maxFileMb === 4);
    delete process.env.VERCEL;

    const client = backend('services/ai/client');
    const [v512] = await client.embed(['x'], { dimensions: 512 });
    const [vDefault] = await client.embed(['x']);
    check('embed with dimensions → 512 numbers; default unchanged', v512.length === 512 && vDefault.length === 256);

    const tools = backend('services/ai/tools');
    check('tool registry still 13 tools, default cap 1500', tools.names().length === 13 && tools.MAX_OUTPUT === 1500);

    const { entityOf } = backend('services/audit');
    check('activity log maps /documents', entityOf('/documents') === 'document' && entityOf('/documents/abc/reindex') === 'document');
    await done();
})();
