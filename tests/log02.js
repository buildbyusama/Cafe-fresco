// Step 0.2: request ids, access log, redaction, health. Usage: node log02.js <backend log file>
const fs = require('fs');
const { URL, check, done } = require('./lib');
const LOG = process.argv[2];
(async () => {
    const h = await fetch(`${URL.API}/health`);
    const body = await h.json();
    check('/health 200 with db up and ai status', h.status === 200 && body.db === 'up' && ['enabled', 'disabled', 'mock'].includes(body.ai), JSON.stringify(body));
    check('every response has X-Request-Id', /^[0-9a-f-]{36}$/.test(h.headers.get('x-request-id') || ''));
    const echo = await fetch(`${URL.API}/category/fetch`, { headers: { 'X-Request-Id': 'test-req-12345678' } });
    check('a safe incoming request id is kept', echo.headers.get('x-request-id') === 'test-req-12345678');
    const bad = await fetch(`${URL.API}/category/fetch`, { headers: { 'X-Request-Id': '<script>alert(1)</script>' } });
    check('an unsafe incoming request id is replaced', bad.headers.get('x-request-id') !== '<script>alert(1)</script>');
    const secret = 'Sup3rSecretPw' + Date.now();
    await fetch(`${URL.API}/user/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@x.com', password: secret }) });
    const resetTok = 'deadbeef' + Date.now();
    await fetch(`${URL.API}/user/reset-password/${resetTok}`);
    const nf = await fetch(`${URL.API}/nope-${Date.now()}`);
    check('unknown route still JSON 404', nf.status === 404 && (await nf.json()).message === 'Not found');
    await new Promise((r) => setTimeout(r, 500));
    const log = fs.readFileSync(LOG, 'utf8');
    check('password never written to the log', !log.includes(secret));
    check('reset token masked in the access log', !log.includes(resetTok) && log.includes('reset-password/:token'));
    const lines = log.split('\n').filter((l) => l.includes('test-req-12345678'));
    check('access line carries reqId, method, path, status, ms', lines.some((l) => { try { const j = JSON.parse(l); return j.method === 'GET' && j.path === '/category/fetch' && j.status === 200 && typeof j.ms === 'number'; } catch { return false; } }));
    check('no stack traces in responses', !JSON.stringify(await (await fetch(`${URL.API}/product/zzz`)).json()).includes('at '));
    await done();
})();
