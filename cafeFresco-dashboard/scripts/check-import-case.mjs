// Fails when a relative import's letter case differs from the file on disk.
// Windows ignores case, Linux (Vercel) does not — this catches it before deploy.
// Usage: node scripts/check-import-case.js [srcDir]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'src');
const EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '/index.js', '/index.jsx'];
const IMPORT_RE = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(p);
    return /\.(jsx?|tsx?|mjs)$/.test(d.name) ? [p] : [];
});

// True when every segment of `target` exists with exactly this casing
const existsExact = (target) => {
    const rel = path.relative(root, target);
    if (rel.startsWith('..')) return fs.existsSync(target); // outside src: just existence
    let current = root;
    for (const part of rel.split(path.sep)) {
        if (!fs.existsSync(current) || !fs.readdirSync(current).includes(part)) return false;
        current = path.join(current, part);
    }
    return true;
};

const problems = [];
for (const file of walk(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
        for (const m of line.matchAll(IMPORT_RE)) {
            const spec = m[1];
            const base = path.resolve(path.dirname(file), spec);
            const candidates = EXTS.map((e) => base + e.replace(/\//g, path.sep));
            const existing = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
            if (!existing) continue; // unresolved imports are the bundler's job
            if (!candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile() && existsExact(c))) {
                problems.push(`${path.relative(process.cwd(), file)}:${i + 1}  "${spec}" — letter case differs from the file on disk`);
            }
        }
    });
}

if (problems.length) {
    console.error(`Import case mismatches (these break the Linux/Vercel build):\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`Import case check passed (${root})`);
