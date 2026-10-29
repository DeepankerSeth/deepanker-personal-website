import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";
import { fromHtml } from "hast-util-from-html";
import ts from "typescript";
const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist", "client");
const host = "127.0.0.1";
const port = Number(process.env.AUDIT_PORT || 4324);
const baseUrl = new URL(process.env.AUDIT_BASE_URL || `http://${host}:${port}`);
const origin = "https://deepankerseth.com";
if (!["http:", "https:"].includes(baseUrl.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname) || baseUrl.username || baseUrl.password) {
    throw new Error("AUDIT_BASE_URL must be a loopback URL without credentials. This checker never targets production.");
}
// Preserve the accepted release's per-page delivery budgets. Include inline
// code and imported dependencies; private editor assets count only if loaded.
const budgets = { cssFile: 36 * 1024, cssRaw: 51 * 1024, cssGzip: 16 * 1024, jsRaw: 32 * 1024, jsGzip: 12 * 1024 };
let server;
let serverOutput = "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition)
    throw new Error(message); };
const bytes = (value) => Buffer.byteLength(value);
const format = (value) => `${(value / 1024).toFixed(1)} KiB`;
const text = (node) => !node ? "" : node.type === "text" ? node.value : (node.children || []).map(text).join("");
const has = (node, property) => Object.hasOwn(node.properties || {}, property);
function elements(tree) {
    const result = [];
    function visit(node) { if (node.type === "element")
        result.push(node); for (const child of node.children || [])
        visit(child); }
    visit(tree);
    return result;
}
const nodes = (html) => elements(fromHtml(html));
const find = (all, tag, property, value) => all.find((node) => node.tagName === tag && (!property || node.properties[property] === value));
const rel = (node, value) => (node.properties.rel || []).includes(value);
const className = (node, value) => (node.properties.className || []).includes(value);
async function fetchHtml(route) {
    const response = await fetch(new URL(route, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(15000) });
    assert(response.ok, `${route} returned ${response.status}`);
    return response.text();
}
async function waitForServer() {
    const start = Date.now();
    while (Date.now() - start < 45000) {
        if (server && server.exitCode !== null)
            throw new Error(`Local server exited before audit.\n${serverOutput}`);
        const launchAccepted = !server || serverOutput.includes(`Local built website: http://127.0.0.1:${port}/`);
        if (launchAccepted) {
            try {
                if ((await fetch(baseUrl, { redirect: "manual", signal: AbortSignal.timeout(2000) })).ok)
                    return;
            }
            catch { /* Starting. */ }
        }
        await sleep(250);
    }
    throw new Error(`Timed out waiting for server at ${baseUrl}`);
}
// Measure the built Worker response and its actual client dependencies. Astro 7
// no longer has the old serialized manifest; fail clearly on a dev response.
async function requireProductionBuild() {
    await access(path.join(rootDir, "dist", "server", "entry.mjs"));
    await access(distDir);
}
const resourceCache = new Map();
async function resource(url) {
    const key = url.href;
    if (!resourceCache.has(key))
        resourceCache.set(key, (async () => {
            assert(url.origin === baseUrl.origin, `Unexpected external code resource: ${url}. Local audits do not fetch third-party or production code.`);
            const filename = path.resolve(distDir, `.${decodeURIComponent(url.pathname)}`);
            assert(filename.startsWith(`${distDir}${path.sep}`), `Asset escapes dist: ${url.pathname}`);
            return readFile(filename, "utf8").catch(() => { throw new Error(`Missing built asset ${url.pathname}. Rebuild before auditing.`); });
        })());
    return resourceCache.get(key);
}
function scriptImports(source) {
    const imports = new Set();
    const file = ts.createSourceFile("payload.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
            imports.add(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length && ts.isStringLiteral(node.arguments[0]))
            imports.add(node.arguments[0].text);
        ts.forEachChild(node, visit);
    }
    visit(file);
    return [...imports];
}
async function auditPayload(route, html) {
    const all = nodes(html);
    const development = all.some((node) => node.tagName === "script" && String(node.properties.src || "").includes("/@vite/client"));
    const css = new Map();
    const js = new Map();
    const inlineCss = [];
    const inlineJs = [];
    async function collect(kind, reference, owner = new URL(route, baseUrl)) {
        const url = new URL(reference, owner);
        const bucket = kind === "css" ? css : js;
        if (bucket.has(url.href))
            return;
        bucket.set(url.href, "");
        const source = await resource(url);
        bucket.set(url.href, source);
        if (kind === "css") {
            for (const match of source.matchAll(/@import\s*(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')/gi))
                await collect("css", match.slice(1).find(Boolean), url);
        }
        else {
            for (const imported of scriptImports(source)) {
                assert(/^(?:[./]|https?:)/.test(imported), `Unresolved browser import ${imported} in ${url}`);
                await collect("js", imported, url);
            }
        }
    }
    assert(!development, "Run the payload audit against npm run serve:local (the built Worker), not the Vite development server.");
    for (const node of all) {
        const p = node.properties;
        if (node.tagName === "link" && (rel(node, "stylesheet") || (rel(node, "preload") && p.as === "style"))) {
            await collect("css", p.href);
        }
        if (node.tagName === "link" && rel(node, "modulepreload"))
            await collect("js", p.href);
        if (node.tagName === "style")
            inlineCss.push(text(node));
        if (node.tagName === "script" && (!p.type || ["module", "text/javascript", "application/javascript"].includes(p.type))) {
            if (p.src) {
                await collect("js", p.src);
            }
            else {
                const source = text(node);
                inlineJs.push(source);
                for (const imported of scriptImports(source))
                    await collect("js", imported);
            }
        }
        for (const [key, value] of Object.entries(p))
            if (/^on[A-Z]/.test(key) && typeof value === "string")
                inlineJs.push(value);
    }
    // Inline CSS/JS compresses within the document; combine each category rather
    // than pretending every inline block is a separate network response.
    const cssSources = [...css.values(), inlineCss.join("\n")].filter(Boolean);
    const jsSources = [...js.values(), inlineJs.join("\n")].filter(Boolean);
    const cssRaw = cssSources.reduce((sum, source) => sum + bytes(source), 0);
    const cssGzip = cssSources.reduce((sum, source) => sum + gzipSync(source).byteLength, 0);
    const jsRaw = jsSources.reduce((sum, source) => sum + bytes(source), 0);
    const jsGzip = jsSources.reduce((sum, source) => sum + gzipSync(source).byteLength, 0);
    const largestCss = Math.max(0, ...[...css.values()].map(bytes));
    assert(cssRaw > 0, `${route}: no CSS payload was measured`);
    for (const [label, actual, limit] of [["largest stylesheet", largestCss, budgets.cssFile], ["CSS raw", cssRaw, budgets.cssRaw], ["CSS gzip estimate", cssGzip, budgets.cssGzip], ["JS including inline", jsRaw, budgets.jsRaw], ["JS gzip estimate", jsGzip, budgets.jsGzip]]) {
        assert(actual <= limit, `${route}: ${label} exceeds budget (${format(actual)} > ${format(limit)})`);
    }
    console.log(`Payload OK ${route}: CSS ${format(cssRaw)} raw / ${format(cssGzip)} gzip; JS ${format(jsRaw)} raw / ${format(jsGzip)} gzip (${format(bytes(inlineJs.join("\n")))} inline).`);
}
function auditStructure(route, html, canonicalPath, { essay = false } = {}) {
    const all = nodes(html);
    assert(find(all, "html", "lang", "en"), `${route}: missing document language`);
    assert(all.some((node) => node.tagName === "a" && node.properties.href === "#main-content" && text(node).trim()), `${route}: missing skip link`);
    assert(find(all, "main", "id", "main-content"), `${route}: missing main landmark`);
    assert(find(all, "nav", "ariaLabel", "Primary") || find(all, "nav", "ariaLabel", "Published writing"), `${route}: primary navigation lacks a label`);
    assert(all.filter((node) => node.tagName === "h1").length >= 1, `${route}: missing page heading`);
    if (!essay)
        assert(all.filter((node) => node.tagName === "h1").length === 1, `${route}: expected one h1`);
    const canonical = all.find((node) => node.tagName === "link" && rel(node, "canonical"));
    const expected = new URL(canonicalPath, origin).href.replace(/\/$/, "");
    assert(String(canonical?.properties.href || "").replace(/\/$/, "") === expected, `${route}: incorrect canonical URL`);
    for (const property of ["og:url", "twitter:url"])
        assert(String(find(all, "meta", "property", property)?.properties.content || "").replace(/\/$/, "") === expected, `${route}: incorrect ${property}`);
    assert(!all.some((node) => node.tagName === "meta" && node.properties.name === "robots" && /\bnoindex\b/i.test(node.properties.content || "")), `${route}: unexpected public noindex`);
    if (essay) {
        assert(find(all, "article"), `${route}: missing article landmark`);
        assert(/min read/.test(html), `${route}: missing reading time`);
        assert(all.some(node => node.tagName === 'aside' && node.properties.ariaLabel === 'Reading controls'), `${route}: missing labeled reading controls`);
        assert(all.some(node => node.tagName === 'summary' && text(node).includes('Reading settings')), `${route}: missing native reading settings disclosure`);
        assert(all.some(node => node.tagName === 'button' && has(node, 'dataSave') && text(node).trim()), `${route}: missing named save-place action`);
        const progress = all.find(node => node.properties.role === 'progressbar');
        if (progress)
            assert(progress.properties.ariaLabel && progress.properties.ariaValueMin === 0 && progress.properties.ariaValueMax === 100 && Number.isFinite(progress.properties.ariaValueNow), `${route}: semantic progress must be named with min/max/current values`);
        else
            assert(all.some(node => node.properties.ariaHidden === 'true' && elements(node).some(child => has(child, 'dataReadingProgress'))), `${route}: decorative progress must be hidden from the accessibility tree`);
        assert(all.some(node => has(node, 'dataSaveStatus') && (node.properties.role === 'status' || node.properties.ariaLive === 'polite')), `${route}: missing polite save/resume status`);
        assert(all.some((node) => has(node, "dataEssayProse")), `${route}: missing continuous prose container`);
    }
    console.log(`Structure OK ${route}`);
    return all;
}
async function auditArchive(html) {
    const all = nodes(html), form = find(all, 'form', 'id', 'index-search');
    assert(form?.properties.role === 'search' && String(form.properties.method).toLowerCase() === 'get' && form.properties.action === '/writing', 'Archive: search must work as a native GET form');
    assert(all.some(node => node.tagName === 'label' && node.properties.htmlFor?.includes('index-query')), 'Archive: missing search label');
    assert(find(all, 'input', 'id', 'index-query')?.properties.ariaControls?.includes('writing-results'), 'Archive: search is not associated with results');
    const index = find(all, 'nav', 'id', 'writing-results');
    assert(index?.properties.ariaLabel, 'Archive: result navigation must be labeled');
    const entries = elements(index).filter(node => has(node, 'dataEntry'));
    const data = JSON.parse(text(find(all, 'script', 'id', 'writing-data')));
    const count = all.find(node => has(node, 'dataResultCount'));
    assert(count?.properties.role === 'status' && count.properties.ariaLive === 'polite' && count.properties.ariaAtomic === 'true', 'Archive: count must be a polite atomic live region');
    assert(text(count) === `${entries.length} of ${entries.length} pieces`, 'Archive: unfiltered count disagrees with entries');
    const items = entries.map(node => data[Number(node.properties.dataEntry)]);
    assert(items.every(Boolean), 'Archive: every row must resolve to its writing data');
    for (const [i, node] of entries.entries())
        assert(elements(node).some(child => child.tagName === 'a' && child.properties.href === items[i].route), 'Archive: missing real essay link');
    const cases = [{ q: '__audit_no_matching_writing__', tag: '' }];
    if (items.length) {
        cases.push({ q: items[0].title, tag: '' }, { q: items[0].title, tag: '__audit_unknown_topic__' });
        const bodyWord = items[0].text.split(/\s+/).find(word => word.length > 8);
        if (bodyWord)
            cases.push({ q: bodyWord, tag: '' });
    }
    const tagged = items.find(item => item.tags?.length);
    if (tagged)
        cases.push({ q: '', tag: tagged.tags[0] });
    for (const state of cases) {
        const params = new URLSearchParams(state), filteredNodes = nodes(await fetchHtml(`/writing?${params}`));
        const filteredIndex = find(filteredNodes, 'nav', 'id', 'writing-results');
        assert(filteredIndex, 'Archive: missing filtered result region');
        const visible = elements(filteredIndex).filter(node => has(node, 'dataEntry') && !node.properties.hidden);
        const expected = items.filter(item => [item.title, item.description || '', ...item.tags, item.text].join(' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase().includes(state.q.trim().toLocaleLowerCase()) && (!state.tag || item.tags.includes(state.tag)));
        assert(JSON.stringify(visible.map(node => node.properties.dataEssayId)) === JSON.stringify(expected.map(item => item.id)), `Archive: GET filtering does not match ${params}`);
        assert(text(filteredNodes.find(node => has(node, 'dataResultCount'))) === `${expected.length} of ${entries.length} pieces`, 'Archive: filtered count is inaccurate before JavaScript');
        const empty = elements(filteredIndex).find(node => className(node, 'no-results'));
        assert(empty && Boolean(empty.properties.hidden) === (expected.length > 0), 'Archive: incorrect server-rendered empty state');
        const filteredForm = find(filteredNodes, 'form', 'id', 'index-search');
        assert(elements(filteredForm).some(node => node.tagName === 'a' && node.properties.href === '/writing' && /Reset/i.test(text(node))), 'Archive: reset needs a working native link');
    }
    console.log('Archive OK: full-text search, combined query/topic, result counts and empty state work before JavaScript.');
    return items.map(item => item.route);
}
async function auditRedirect(route, target) {
    const response = await fetch(new URL(route, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(15000) });
    assert(response.status === 308, `${route}: expected 308 compatibility redirect, got ${response.status}`);
    assert(new URL(response.headers.get('location'), baseUrl).href === new URL(target, baseUrl).href, `${route}: incorrect canonical redirect`);
}
async function main() {
    await requireProductionBuild();
    if (!process.env.AUDIT_BASE_URL) {
        server = spawn(process.execPath, ["scripts/local-serve.mjs", "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
        for (const stream of [server.stdout, server.stderr])
            stream.on("data", chunk => { serverOutput = (serverOutput + chunk).slice(-16000); });
    }
    try {
        await waitForServer();
        let archiveHtml;
        for (const route of ["/", "/writing"]) {
            const html = await fetchHtml(route);
            auditStructure(route, html, route);
            await auditPayload(route, html);
            if (route === "/writing")
                archiveHtml = html;
        }
        const paths = await auditArchive(archiveHtml);
        assert(paths.length, "No published essay available to audit; run npm run setup:local in a fresh checkout first.");
        for (const route of new Set(paths)) {
            const html = await fetchHtml(route);
            auditStructure(route, html, route, { essay: true });
            await auditPayload(route, html);
            await auditRedirect(`/classic${route}?passage=p-check`, `${route}?passage=p-check`);
        }
        await auditRedirect('/classic?q=attention', '/?q=attention');
        await auditRedirect('/classic/writing?q=attention&tag=Thought', '/writing?q=attention&tag=Thought');
        for (const route of ["/writing/__audit_missing_essay__", "/classic/writing/__audit_missing_essay__"]) {
            const response = await fetch(new URL(route, baseUrl), { redirect: "manual", signal: AbortSignal.timeout(15000) });
            assert(response.status === 404, `${route}: missing essay should return 404`);
        }
        const rss = await fetchHtml("/rss.xml");
        assert(rss.includes(`${origin}${paths[0]}`) && !rss.includes(`${origin}/classic/writing/`), "RSS: essay links must use canonical root URLs");
        assert(!server || server.exitCode === null, `Owned local server exited during audit.\n${serverOutput}`);
        console.log(`Final QA audit passed against ${baseUrl}. CSS/JS totals include inline and imported code; font/image binaries are outside these code budgets. Browser interaction, reduced-motion and visual checks remain separate.`);
    }
    finally {
        if (server && server.exitCode === null) {
            server.kill("SIGINT");
            await sleep(500);
            if (server.exitCode === null)
                server.kill("SIGTERM");
        }
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
