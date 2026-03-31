import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { gzipSync } from "node:zlib";

const rootDir = process.cwd();
const distAstroDir = path.join(rootDir, "dist", "_astro");
const host = "127.0.0.1";
const port = Number(process.env.AUDIT_PORT || 4324);
const baseUrl = process.env.AUDIT_BASE_URL || `http://${host}:${port}`;
const startupTimeoutMs = 45_000;
const startupPollMs = 750;
const performanceBudgets = {
	maxCssRawBytes: 25 * 1024,
	totalCssRawBytes: 51 * 1024,
	totalCssGzipBytes: 16 * 1024,
	totalClientJsRawBytes: 12 * 1024,
};

const routeChecks = [
	{
		path: "/",
		label: "Observatory home",
		expectedH1Count: 1,
		canonicalPath: "/",
		requiredPatterns: [
			{
				pattern: /<html[^>]+lang="en"/i,
				message: "missing document language",
			},
			{
				pattern: /<a[^>]+class="skip-link"[^>]+href="#main-content"[^>]*>Skip to content<\/a>/i,
				message: "missing skip link",
			},
			{
				pattern: /<main[^>]+id="main-content"[^>]*>/i,
				message: "missing main landmark",
			},
			{
				pattern: /<nav[^>]+aria-label="Primary"[^>]*>/i,
				message: "missing labelled primary navigation",
			},
			{
				pattern: /<link[^>]+rel="canonical"[^>]*>/i,
				message: "missing canonical link",
			},
		],
		forbiddenPatterns: [
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "unexpected noindex directive on canonical home",
			},
		],
	},
	{
		path: "/writing",
		label: "Observatory library",
		expectedH1Count: 1,
		canonicalPath: "/writing",
		requiredPatterns: [
			{
				pattern: /<form[^>]+id="library-controls"[^>]+role="search"[^>]*>/i,
				message: "missing search landmark for archive controls",
			},
			{
				pattern: /<label[^>]+for="library-search"/i,
				message: "missing search label",
			},
			{
				pattern: /id="library-count"[^>]+aria-live="polite"/i,
				message: "missing polite live region for result count",
			},
			{
				pattern: /aria-controls="library-list"/i,
				message: "missing list control association",
			},
		],
		forbiddenPatterns: [
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "unexpected noindex directive on canonical library",
			},
		],
	},
	{
		path: "/classic",
		label: "Classic home",
		expectedH1Count: 1,
		canonicalPath: "/",
		requiredPatterns: [
			{
				pattern: /<html[^>]+lang="en"/i,
				message: "missing document language",
			},
			{
				pattern: /<a[^>]+class="skip-link"[^>]+href="#main-content"[^>]*>Skip to content<\/a>/i,
				message: "missing skip link",
			},
			{
				pattern: /<main[^>]+id="main-content"[^>]*>/i,
				message: "missing main landmark",
			},
			{
				pattern: /Read all writings/i,
				message: "missing classic home CTA",
			},
		],
		forbiddenPatterns: [
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "unexpected noindex directive on classic home",
			},
		],
	},
	{
		path: "/classic/writing",
		label: "Classic writing",
		expectedH1Count: 1,
		canonicalPath: "/writing",
		requiredPatterns: [
			{
				pattern: /aria-label="Search writings"/i,
				message: "missing classic search input label",
			},
			{
				pattern: /<h1[^>]*>Writing<\/h1>/i,
				message: "missing classic writing heading",
			},
		],
		forbiddenPatterns: [
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "unexpected noindex directive on classic writing",
			},
		],
	},
];

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForServer() {
	const startedAt = Date.now();

	while (Date.now() - startedAt < startupTimeoutMs) {
		try {
			const response = await fetch(baseUrl);
			if (response.ok) return;
		} catch {
			// Server may still be starting.
		}

		await sleep(startupPollMs);
	}

	throw new Error(`Timed out waiting for dev server at ${baseUrl}`);
}

function spawnDevServer() {
	return spawn(
		"npm",
		["run", "dev", "--", "--host", host, "--port", String(port)],
		{
			stdio: "pipe",
			shell: process.platform === "win32",
		}
	);
}

async function fetchHtml(pathname) {
	const response = await fetch(new URL(pathname, baseUrl));
	if (!response.ok) {
		throw new Error(`${pathname} returned ${response.status}`);
	}

	return response.text();
}

function countMatches(source, pattern) {
	return [...source.matchAll(pattern)].length;
}

function discoverSlug(html) {
	const match = html.match(/href="\/writing\/([^"'?#/<>]+)/);
	return match?.[1] ?? null;
}

async function collectClientAssets() {
	const entries = await readdir(distAstroDir, { withFileTypes: true }).catch(() => {
		throw new Error(
			"Missing built client assets in dist/_astro. Run `npm run check` or `npm run build` before `npm run audit`."
		);
	});

	const assets = [];
	for (const entry of entries) {
		if (!entry.isFile()) continue;

		const fullPath = path.join(distAstroDir, entry.name);
		const source = await readFile(fullPath);
		assets.push({
			name: entry.name,
			ext: path.extname(entry.name),
			rawBytes: source.byteLength,
			gzipBytes: gzipSync(source).byteLength,
		});
	}

	return assets;
}

function sumBytes(assets, key) {
	return assets.reduce((total, asset) => total + asset[key], 0);
}

function assertBudget(label, actual, budget) {
	assert(
		actual <= budget,
		`${label} exceeded budget (${formatBytes(actual)} > ${formatBytes(budget)})`
	);
}

async function auditPerformance() {
	const assets = await collectClientAssets();
	const cssAssets = assets.filter((asset) => asset.ext === ".css");
	const clientJsAssets = assets.filter((asset) => asset.ext === ".js");
	const largestCss = cssAssets.reduce(
		(currentLargest, asset) =>
			!currentLargest || asset.rawBytes > currentLargest.rawBytes
				? asset
				: currentLargest,
		null
	);
	const totalCssRawBytes = sumBytes(cssAssets, "rawBytes");
	const totalCssGzipBytes = sumBytes(cssAssets, "gzipBytes");
	const totalClientJsRawBytes = sumBytes(clientJsAssets, "rawBytes");

	assert(cssAssets.length > 0, "No built CSS assets found in dist/_astro");
	assertBudget(
		"Largest CSS asset",
		largestCss?.rawBytes ?? 0,
		performanceBudgets.maxCssRawBytes
	);
	assertBudget(
		"Total CSS payload",
		totalCssRawBytes,
		performanceBudgets.totalCssRawBytes
	);
	assertBudget(
		"Total gzip CSS payload",
		totalCssGzipBytes,
		performanceBudgets.totalCssGzipBytes
	);
	assertBudget(
		"Total client JS payload",
		totalClientJsRawBytes,
		performanceBudgets.totalClientJsRawBytes
	);

	console.log(
		`Audit OK: CSS budget (${formatBytes(totalCssRawBytes)} raw / ${formatBytes(totalCssGzipBytes)} gzip)`
	);
	console.log(
		`Audit OK: Largest CSS asset ${largestCss?.name} (${formatBytes(largestCss?.rawBytes ?? 0)})`
	);
	console.log(
		`Audit OK: Client JS payload ${formatBytes(totalClientJsRawBytes)} raw`
	);
}

function assertMetadataUrls(label, html, canonicalPath) {
	const canonicalUrl = `https://deepankerseth.com${
		canonicalPath === "/" ? "" : canonicalPath
	}`;
	const canonicalPattern = new RegExp(
		`<link[^>]+rel="canonical"[^>]+href="${escapeRegExp(canonicalUrl)}\\/?"[^>]*>`,
		"i"
	);
	const ogPattern = new RegExp(
		`<meta[^>]+property="og:url"[^>]+content="${escapeRegExp(canonicalUrl)}\\/?"[^>]*>`,
		"i"
	);
	const twitterPattern = new RegExp(
		`<meta[^>]+property="twitter:url"[^>]+content="${escapeRegExp(canonicalUrl)}\\/?"[^>]*>`,
		"i"
	);

	assert(canonicalPattern.test(html), `${label}: incorrect canonical URL`);
	assert(ogPattern.test(html), `${label}: incorrect og:url`);
	assert(twitterPattern.test(html), `${label}: incorrect twitter:url`);
}

function assertRouteStructure(
	label,
	html,
	requiredPatterns,
	expectedH1Count = null,
	forbiddenPatterns = [],
	canonicalPath = null
) {
	for (const requiredPattern of requiredPatterns) {
		assert(requiredPattern.pattern.test(html), `${label}: ${requiredPattern.message}`);
	}

	for (const forbiddenPattern of forbiddenPatterns) {
		assert(!forbiddenPattern.pattern.test(html), `${label}: ${forbiddenPattern.message}`);
	}

	if (expectedH1Count !== null) {
		assert(
			countMatches(html, /<h1\b/gi) === expectedH1Count,
			`${label}: expected exactly ${expectedH1Count} h1`
		);
	}

	if (canonicalPath) {
		assertMetadataUrls(label, html, canonicalPath);
	}
}

async function auditRoutes() {
	const htmlByPath = new Map();

	for (const route of routeChecks) {
		const html = await fetchHtml(route.path);
		assertRouteStructure(
			route.label,
			html,
			route.requiredPatterns,
			route.expectedH1Count ?? null,
			route.forbiddenPatterns ?? [],
			route.canonicalPath ?? null
		);
		htmlByPath.set(route.path, html);
		console.log(
			`Audit OK: ${route.label} structure (${formatBytes(Buffer.byteLength(html))} HTML)`
		);
	}

	const slug =
		discoverSlug(htmlByPath.get("/") || "") ||
		discoverSlug(htmlByPath.get("/writing") || "");
	assert(slug, "Could not discover a canonical post route to audit");

	const postPath = `/writing/${slug}`;
	const postHtml = await fetchHtml(postPath);
	assertRouteStructure(
		"Observatory essay",
		postHtml,
		[
			{
				pattern: /<article[^>]*>/i,
				message: "missing article landmark",
			},
			{
				pattern: /data-reading-controls/i,
				message: "missing reading controls",
			},
			{
				pattern: /role="progressbar"/i,
				message: "missing accessible reading progressbar",
			},
			{
				pattern: /aria-live="polite"/i,
				message: "missing polite live region for reading progress",
			},
		{
			pattern: /<h1\b/i,
			message: "missing page-level heading",
		},
		],
		null,
		[
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "unexpected noindex directive on canonical essay",
			},
		],
		`/writing/${slug}`
	);

	console.log(
		`Audit OK: Observatory essay structure (${formatBytes(Buffer.byteLength(postHtml))} HTML)`
	);

	const classicPostPath = `/classic/writing/${slug}`;
	const classicPostHtml = await fetchHtml(classicPostPath);
	assertRouteStructure(
		"Classic essay",
		classicPostHtml,
		[
			{
				pattern: /<article[^>]*>/i,
				message: "missing classic article landmark",
			},
			{
				pattern: /min read/i,
				message: "missing classic reading meta",
			},
			{
				pattern: /<h1\b/i,
				message: "missing classic page-level heading",
			},
		],
		null,
		[
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "unexpected noindex directive on classic essay",
			},
		],
		`/writing/${slug}`
	);

	console.log(
		`Audit OK: Classic essay structure (${formatBytes(Buffer.byteLength(classicPostHtml))} HTML)`
	);
}

async function main() {
	let devServer = null;

	if (!process.env.AUDIT_BASE_URL) {
		devServer = spawnDevServer();
		devServer.stdout?.on("data", () => {});
		devServer.stderr?.on("data", () => {});
	}

	try {
		await waitForServer();
		await auditPerformance();
		await auditRoutes();
		console.log(`Final QA audit passed against ${baseUrl}`);
	} finally {
		if (devServer && !devServer.killed) {
			devServer.kill("SIGINT");
			await sleep(250);
			if (!devServer.killed) {
				devServer.kill("SIGTERM");
			}
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
