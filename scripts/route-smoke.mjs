import { spawn } from 'node:child_process';
import process from 'node:process';
const port = Number(process.env.SMOKE_PORT || 4323);
const baseUrl = new URL(process.env.SMOKE_BASE_URL || `http://127.0.0.1:${port}`);
if (!['http:', 'https:'].includes(baseUrl.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(baseUrl.hostname) || baseUrl.username || baseUrl.password) {
    throw new Error('SMOKE_BASE_URL must be a loopback URL without credentials. This checker never targets production.');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition)
    throw new Error(message); };
let server;
let output = '';
async function waitForServer() {
    const started = Date.now();
    while (Date.now() - started < 45000) {
        if (server && server.exitCode !== null)
            throw new Error(`Local server exited before smoke verification.\n${output}`);
        // The helper emits this only after its occupied-port/configuration checks.
        const launchAccepted = !server || output.includes(`Local built website: http://127.0.0.1:${port}/`);
        if (launchAccepted) {
            try {
                if ((await fetch(baseUrl, { redirect: 'manual', signal: AbortSignal.timeout(2000) })).ok)
                    return;
            }
            catch { /* Starting. */ }
        }
        await sleep(250);
    }
    throw new Error(`Timed out waiting for built local server at ${baseUrl}\n${output}`);
}
async function fetchHtml(route, snippets) {
    const response = await fetch(new URL(route, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert(response.status === 200, `${route} returned ${response.status}`);
    const html = await response.text();
    for (const snippet of snippets)
        assert(html.includes(snippet), `${route} is missing ${snippet}`);
    console.log(`Smoke OK: ${route}`);
    return html;
}
async function redirect(route, target) {
    const response = await fetch(new URL(route, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    assert(response.status === 308, `${route}: expected permanent compatibility redirect, got ${response.status}`);
    assert(new URL(response.headers.get('location'), baseUrl).href === new URL(target, baseUrl).href, `${route}: incorrect redirect target`);
    console.log(`Compatibility OK: ${route} → ${target}`);
}
try {
    if (!process.env.SMOKE_BASE_URL) {
        server = spawn(process.execPath, ['scripts/local-serve.mjs', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
        for (const stream of [server.stdout, server.stderr])
            stream.on('data', chunk => { output = (output + chunk).slice(-16000); });
    }
    await waitForServer();
    const home = await fetchHtml('/', ['Here I write when a thought has ripened enough to ask for form.', 'The writing']);
    const archive = await fetchHtml('/writing', ['The archive', 'Search the writing']);
    const slug = (home + archive).match(/href="\/writing\/([^"'?#/<>]+)/)?.[1];
    assert(slug, 'No published piece found. Run npm run setup:local in a fresh checkout first.');
    await fetchHtml(`/writing/${slug}`, ['data-essay-prose', 'aria-label="Reading controls"', 'data-contents', 'Return to the writing index', 'href="/#writing"', 'min read']);
    await redirect('/classic?q=attention', '/?q=attention');
    await redirect('/classic/writing?q=attention&tag=Thought', '/writing?q=attention&tag=Thought');
    await redirect(`/classic/writing/${slug}?passage=p-check`, `/writing/${slug}?passage=p-check`);
    for (const route of ['/writing/__smoke_missing__', '/classic/writing/__smoke_missing__']) {
        const response = await fetch(new URL(route, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
        assert(response.status === 404, `${route}: expected a real 404`);
    }
    assert(!server || server.exitCode === null, `Owned local server exited during smoke verification.\n${output}`);
    console.log(`Smoke passed against ${baseUrl}. Browser interaction and visual verification remain separate.`);
}
finally {
    if (server && server.exitCode === null) {
        server.kill('SIGINT');
        await sleep(500);
        if (server.exitCode === null)
            server.kill('SIGTERM');
    }
}
