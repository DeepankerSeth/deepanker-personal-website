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
		mustInclude: ["Observatory", "Enter the library"],
	},
	{
		path: "/writing",
		mustInclude: ["Deepanker Seth's Writings", "Search writings"],
	},
	{
		path: "/classic",
		mustInclude: ["Read all writings", "Latest"],
	},
	{
		path: "/classic/writing",
		mustInclude: ["Writing", "Search writings"],
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
	const match = html.match(/href="\/writing\/([^"'?#/<>]+)/);
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
			discoverSlug(htmlByRoute.get("/") || "") ||
			discoverSlug(htmlByRoute.get("/writing") || "");

		if (!slug) {
			throw new Error("Could not discover a published post slug from the public routes.");
		}

		const observatoryPostRoute = `/writing/${slug}`;
		const classicPostRoute = `/classic/writing/${slug}`;
		const observatoryPostHtml = await fetchHtml(observatoryPostRoute);
		assertIncludes(observatoryPostRoute, observatoryPostHtml, [
			"Read in classic",
		]);
		console.log(`Smoke OK: ${observatoryPostRoute}`);

		const classicPostHtml = await fetchHtml(classicPostRoute);
		assertIncludes(classicPostRoute, classicPostHtml, ["min read"]);
		console.log(`Smoke OK: ${classicPostRoute}`);

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
