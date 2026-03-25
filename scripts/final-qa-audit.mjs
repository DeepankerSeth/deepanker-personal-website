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
	maxCssRawBytes: 24 * 1024,
	totalCssRawBytes: 48 * 1024,
	totalCssGzipBytes: 16 * 1024,
	totalClientJsRawBytes: 12 * 1024,
};

const routeChecks = [
	{
		path: "/v2",
		label: "V2 home",
		expectedH1Count: 1,
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
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "missing preview noindex directive",
			},
			{
				pattern: /<link[^>]+rel="canonical"[^>]*>/i,
				message: "missing canonical link",
			},
		],
	},
	{
		path: "/v2/writing",
		label: "V2 library",
		expectedH1Count: 1,
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
			{
				pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
				message: "missing preview noindex directive",
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
	const match = html.match(/\/v2\/writing\/([^"'?#/<>]+)/);
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

function assertRouteStructure(label, html, requiredPatterns, expectedH1Count = null) {
	for (const requiredPattern of requiredPatterns) {
		assert(requiredPattern.pattern.test(html), `${label}: ${requiredPattern.message}`);
	}

	if (expectedH1Count !== null) {
		assert(
			countMatches(html, /<h1\b/gi) === expectedH1Count,
			`${label}: expected exactly ${expectedH1Count} h1`
		);
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
			route.expectedH1Count ?? null
		);
		htmlByPath.set(route.path, html);
		console.log(
			`Audit OK: ${route.label} structure (${formatBytes(Buffer.byteLength(html))} HTML)`
		);
	}

	const slug =
		discoverSlug(htmlByPath.get("/v2") || "") ||
		discoverSlug(htmlByPath.get("/v2/writing") || "");
	assert(slug, "Could not discover a V2 post route to audit");

	const postPath = `/v2/writing/${slug}`;
	const postHtml = await fetchHtml(postPath);
	assertRouteStructure("V2 essay", postHtml, [
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
			pattern: /<meta[^>]+name="robots"[^>]+content="noindex,follow"[^>]*>/i,
			message: "missing preview noindex directive",
		},
		{
			pattern: /<h1\b/i,
			message: "missing page-level heading",
		},
	]);

	console.log(
		`Audit OK: V2 essay structure (${formatBytes(Buffer.byteLength(postHtml))} HTML)`
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
