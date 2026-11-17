// Parses one PDF in a SEPARATE PROCESS (child_process.fork). A malformed PDF can crash pdf.js's native
// helper with a segmentation fault; in a worker thread that would take the whole server down, in a
// child process only this helper dies and the upload gets a friendly error (R6).
const { PDFParse } = require('pdf-parse');

process.once('message', async ({ buffer }) => {
    const parser = new PDFParse({ data: Buffer.from(buffer, 'base64'), isEvalSupported: false });
    try {
        const r = await parser.getText();
        process.send({ ok: true, text: r.text, pages: r.total });
    } catch (err) {
        process.send({ ok: false, name: err?.name || 'Error', message: String(err?.message || err).slice(0, 200) });
    } finally {
        await parser.destroy().catch(() => {});
        process.exit(0);
    }
});
