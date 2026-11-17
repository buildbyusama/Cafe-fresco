// Uploaded file → clean text, safely (docs/RAG_PLAN.md R6, R7). The file type comes from its content,
// never its name. Every failure is an ExtractError with a message that is safe to show an admin.
const path = require('path');
const { fork } = require('child_process');
const yauzl = require('yauzl');
const mammoth = require('mammoth');
const { rag } = require('../../config/env');

class ExtractError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ExtractError';
    }
}

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', md: 'text/markdown' };
const PDF_TIMEOUT_MS = 20000;
const DOCX_MAX_UNPACKED = 50 * 1024 * 1024;
const DOCX_MAX_ENTRIES = 2000;

const DAMAGED = "This PDF couldn't be read. It may be damaged; try saving it again.";

// Separate process: a crash in the PDF library (it happens on malformed files) can't take the server down
function pdfText(buffer) {
    return new Promise((resolve, reject) => {
        const child = fork(path.join(__dirname, 'pdfWorker.js'), [], { execArgv: ['--max-old-space-size=256'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        let settled = false;
        const finish = (fn) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (child.exitCode === null) child.kill('SIGKILL');
            fn();
        };
        const timer = setTimeout(() => finish(() => reject(new ExtractError('This PDF took too long to read. Try saving it again or upload it as a Word file.'))), PDF_TIMEOUT_MS);
        child.once('message', (m) => finish(() => {
            if (m.ok) return resolve({ text: m.text, pages: m.pages });
            if (/Password/i.test(m.name) || /password/i.test(m.message)) return reject(new ExtractError('This PDF is password-protected. Remove the password and upload it again.'));
            reject(new ExtractError(DAMAGED));
        }));
        child.once('exit', () => finish(() => reject(new ExtractError(DAMAGED)))); // crashed without answering
        child.once('error', () => finish(() => reject(new ExtractError(DAMAGED))));
        child.send({ buffer: buffer.toString('base64') });
    });
}

// Read the zip's directory first: refuse zip bombs and non-Word zips before anything is unpacked
function inspectDocx(buffer) {
    return new Promise((resolve) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
            if (err) return resolve({ ok: false });
            let total = 0;
            let count = 0;
            let hasBody = false;
            zip.on('entry', (e) => {
                count++;
                total += e.uncompressedSize;
                if (e.fileName === 'word/document.xml') hasBody = true;
                if (count > DOCX_MAX_ENTRIES || total > DOCX_MAX_UNPACKED) {
                    zip.close();
                    return resolve({ ok: true, hasBody, tooBig: true });
                }
                zip.readEntry();
            });
            zip.on('end', () => resolve({ ok: true, hasBody, tooBig: false }));
            zip.on('error', () => resolve({ ok: false }));
            zip.readEntry();
        });
    });
}

const isZip = (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const isPdf = (b) => b.subarray(0, 5).toString('latin1') === '%PDF-';

function asText(buffer) {
    if (buffer.includes(0)) return null; // binary
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
    } catch {
        return null;
    }
}

function clean(text) {
    return String(text)
        .replace(/\r\n?/g, '\n')
        .replace(/^\s*-- \d+ of \d+ --\s*$/gm, '') // pdf-parse page markers
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// Things that look like personal data: shown to the admin as a warning before publishing
const PRIVACY = [
    ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
    ['phone', /(?:\+?\d[\d\s-]{8,14}\d)/g],
    ['card-like number', /\b\d(?:[ -]?\d){12,18}\b/g],
    ['CNIC', /\b\d{5}-\d{7}-\d\b/g],
];
function privacyScan(text) {
    const flags = [];
    for (const [type, re] of PRIVACY) {
        const n = (text.match(re) || []).length;
        if (n) flags.push({ type, count: n });
    }
    return flags;
}

/** buffer + original name → { text, pages, mime, privacyFlags } */
async function extract(buffer, originalName = '') {
    let text;
    let pages = 0;
    let mime;
    if (isPdf(buffer)) {
        mime = MIME.pdf;
        ({ text, pages } = await pdfText(buffer));
        if (clean(text).replace(/\s/g, '').length < 50) throw new ExtractError('This looks like a scanned PDF (images only), so there is no text to read. Upload a text PDF or a Word file.');
    } else if (isZip(buffer)) {
        const z = await inspectDocx(buffer);
        if (!z.ok || !z.hasBody) throw new ExtractError('Use a PDF, Word (.docx), .txt or .md file.');
        if (z.tooBig) throw new ExtractError('This Word file unpacks to an unusually large size and was refused for safety.');
        mime = MIME.docx;
        try {
            text = (await mammoth.extractRawText({ buffer })).value;
        } catch {
            throw new ExtractError("This Word file couldn't be read. Try saving it again.");
        }
    } else {
        text = asText(buffer);
        if (text === null) throw new ExtractError('Use a PDF, Word (.docx), .txt or .md file.');
        mime = /\.(md|markdown)$/i.test(originalName) ? MIME.md : MIME.txt;
    }
    text = clean(text);
    if (text.length < 20) throw new ExtractError('This file has almost no text to learn from.');
    if (text.length > rag().maxChars) throw new ExtractError('This document is over about 200 pages. Split it into smaller files and upload them separately.');
    pages = pages || Math.max(1, Math.ceil(text.length / 3000));
    return { text, pages, mime, privacyFlags: privacyScan(text) };
}

module.exports = { extract, ExtractError, privacyScan, clean, MIME };
