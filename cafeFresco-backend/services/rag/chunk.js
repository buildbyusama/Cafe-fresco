// Text → ~1200-character passages with ~200 characters of overlap, split at paragraph, then sentence,
// then word boundaries (never mid-word). Each passage carries the nearest heading above it.
const { rag } = require('../../config/env');

const MIN = 40;

// Markdown headings, short numbered titles ("2. Catering") and short ALL-CAPS lines
function headingOf(line) {
    const l = line.trim();
    if (/^#{1,6}\s+\S/.test(l)) return l.replace(/^#{1,6}\s+/, '').slice(0, 80);
    if (l.length <= 60 && /^\d+(\.\d+)*\.?\s+\p{Lu}/u.test(l) && !/[.:;,]$/.test(l)) return l.slice(0, 80);
    if (l.length >= 3 && l.length <= 60 && /\p{L}/u.test(l) && l === l.toUpperCase() && /^[\p{Lu}\p{N}\s&'()/-]+$/u.test(l)) return l.slice(0, 80);
    return null;
}

const sentences = (p) => p.match(/[^.!?۔\n]+(?:[.!?۔]+|$)/gu)?.map((s) => s.trim()).filter(Boolean) || [p];

// Break one long piece into parts ≤ max at word boundaries
function byWords(text, max) {
    const out = [];
    let cur = '';
    for (const w of text.split(/\s+/)) {
        if (!w) continue;
        if (cur && cur.length + 1 + w.length > max) { out.push(cur); cur = ''; }
        cur = cur ? `${cur} ${w}` : w.slice(0, max);
    }
    if (cur) out.push(cur);
    return out;
}

// The last ~n characters of a passage, starting at a word boundary
function tail(text, n) {
    if (text.length <= n) return text;
    const cut = text.slice(-n);
    const sp = cut.indexOf(' ');
    return sp >= 0 ? cut.slice(sp + 1) : cut;
}

/** → [{ order, text, heading, chars }] */
function chunk(text, { size = rag().chunkChars, overlap = rag().overlapChars } = {}) {
    // units: paragraphs (or sentences / word groups when a paragraph is too long), each with its heading
    const units = [];
    let heading = '';
    for (const para of String(text).split(/\n\s*\n/)) {
        const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        const h = headingOf(lines[0]);
        if (h) {
            heading = h;
            lines.shift();
            if (!lines.length) continue;
        }
        const body = lines.join(' ');
        if (body.length <= size) units.push({ text: body, heading });
        else for (const s of sentences(body)) for (const part of s.length <= size ? [s] : byWords(s, size)) units.push({ text: part, heading });
    }

    const out = [];
    let cur = null;
    const flush = () => {
        if (cur && cur.text.trim().length >= MIN) out.push({ order: out.length, text: cur.text.trim(), heading: cur.heading, chars: cur.text.trim().length });
    };
    for (const u of units) {
        if (cur && cur.text.length + 1 + u.text.length <= size && cur.heading === u.heading) {
            cur.text += `\n${u.text}`;
            continue;
        }
        flush();
        // overlap: continue the same section with the end of the previous passage
        const carry = cur && cur.heading === u.heading ? tail(cur.text, overlap) : '';
        cur = { text: carry && carry.length + 1 + u.text.length <= size ? `${carry}\n${u.text}` : u.text, heading: u.heading };
    }
    flush();
    return out;
}

module.exports = { chunk, headingOf };
