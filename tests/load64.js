// Step 6.4: load test (SRS 5.1: 500 concurrent users, API p95 within 500 ms). Needs the backend started with LOAD_TEST=true.
// Usage: node load64.js [seconds=30]
const autocannon = require('autocannon');
const { URL, check, done } = require('./lib');
const seconds = Number(process.argv[2] || 30);
const run = (path) => new Promise((resolve, reject) => autocannon({ url: URL.API + path, connections: 500, duration: seconds, timeout: 10 }, (err, r) => (err ? reject(err) : resolve(r))));
(async () => {
    const rows = [];
    for (const path of ['/product/fetch?limit=16&sort=recommended', '/category/fetch', '/reco/trending', '/settings/public', '/health']) {
        await new Promise((x) => setTimeout(x, 5000)); // let the previous run's queue drain
        const r = await run(path);
        const row = { path, rps: Math.round(r.requests.average), p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99, errors: r.errors + r.timeouts, non2xx: r.non2xx };
        rows.push(row);
        console.log(JSON.stringify(row));
        check(`${path}: 500 connections, 0 errors / non-2xx`, row.errors === 0 && row.non2xx === 0, `${row.errors} errors, ${row.non2xx} non-2xx`);
        check(`${path}: p97.5 latency < 500 ms`, row.p97_5 < 500, `${row.p97_5} ms`);
    }
    console.log('\nRESULTS ' + JSON.stringify(rows));
    await done();
})();
