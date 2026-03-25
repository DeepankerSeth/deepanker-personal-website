import { spawn } from "node:child_process";
import process from "node:process";

const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PORT || 4323);
const baseUrl = process.env.SMOKE_BASE_URL || `http://${host}:${port}`;
const startupTimeoutMs = 45_000;
const startupPollMs = 750;

const expectedRoutes = [
	{
		path: "/",
		mustInclude: ["Deepanker Seth", "Read all writings"],
	},
	{
		path: "/writing",
		mustInclude: ["Search writings", "Filter by tag"],
	},
	{
		path: "/v2",
		mustInclude: ["Quiet Observatory", "Enter the library"],
	},
	{
		path: "/v2/writing",
		mustInclude: ["Observatory Library", "A field guide to the writing archive."],
	},
];

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
	const startedAt = Date.now();

	while (Date.now() - startedAt < startupTimeoutMs) {
		try {
			const response = await fetch(baseUrl);
			if (response.ok) {
				return;
			}
		} catch {
			// The dev server may still be booting.
		}

		await sleep(startupPollMs);
	}

	throw new Error(`Timed out waiting for dev server at ${baseUrl}`);
}

async function fetchHtml(pathname) {
	const response = await fetch(new URL(pathname, baseUrl));
	if (!response.ok) {
		throw new Error(`${pathname} returned ${response.status}`);
	}

	return response.text();
}

function assertIncludes(pathname, html, snippets) {
	for (const snippet of snippets) {
		if (!html.includes(snippet)) {
			throw new Error(`${pathname} did not include expected snippet: ${snippet}`);
		}
	}
}

function discoverSlug(html) {
	const match = html.match(/\/v2\/writing\/([^"'?#/<>]+)/);
	return match?.[1] ?? null;
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

async function main() {
	let devServer = null;

	if (!process.env.SMOKE_BASE_URL) {
		devServer = spawnDevServer();
		devServer.stdout?.on("data", () => {});
		devServer.stderr?.on("data", () => {});
	}

	try {
		await waitForServer();

		const htmlByRoute = new Map();
		for (const route of expectedRoutes) {
			const html = await fetchHtml(route.path);
			assertIncludes(route.path, html, route.mustInclude);
			htmlByRoute.set(route.path, html);
			console.log(`Smoke OK: ${route.path}`);
		}

		const slug =
			discoverSlug(htmlByRoute.get("/v2") || "") ||
			discoverSlug(htmlByRoute.get("/v2/writing") || "");

		if (!slug) {
			throw new Error("Could not discover a published post slug from the V2 routes.");
		}

		const v1PostRoute = `/writing/${slug}`;
		const v2PostRoute = `/v2/writing/${slug}`;
		const v1PostHtml = await fetchHtml(v1PostRoute);
		assertIncludes(v1PostRoute, v1PostHtml, ["min read"]);
		console.log(`Smoke OK: ${v1PostRoute}`);

		const v2PostHtml = await fetchHtml(v2PostRoute);
		assertIncludes(v2PostRoute, v2PostHtml, [
			"Artifact reading",
			"Continue the thread",
		]);
		console.log(`Smoke OK: ${v2PostRoute}`);

		console.log(`Smoke test passed against ${baseUrl}`);
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
