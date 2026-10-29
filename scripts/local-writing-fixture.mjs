#!/usr/bin/env node
/**
 * Disposable browser-test fixture, never a production import.
 * Preserves captured public rendered HTML exactly. `content` is captured plain
 * text solely for reading-time/layout tests; it is NOT reconstructed Markdown.
 * Run: node scripts/local-writing-fixture.mjs
 * Optional: --evidence /tmp/captured-pages --persist-to /tmp/new-fixture-state
 * Refuses an existing persistence directory and never supports --remote.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localStatePath } from "./local-paths.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = { "--evidence": join(repo, "tests/fixtures/public-captures"), "--persist-to": join(repo, ".local/review-state") };
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
	const key = args[index];
	if (!(Object.hasOwn(options, key)) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Usage: node scripts/local-writing-fixture.mjs [--evidence PATH] [--persist-to NEW_TEMP_DIRECTORY]");
	options[key] = args[index + 1];
}
const evidence = resolve(options["--evidence"]);
const persistence = localStatePath(options["--persist-to"]);
process.umask(0o077);

// Dates were observed on the public essay pages; creation dates and featured
// flags are local fixture metadata. No author excerpt overrides are invented.
const articles = [
	{ file: "meditations", slug: "meditations", date: "2026-04-01", featured: 1 },
	{ file: "war", slug: "war", date: "2026-03-10", featured: 1 },
	{ file: "abstractions", slug: "abstractions-of-illusion", date: "2026-03-06", featured: 0 },
	{ file: "i-am", slug: "i-am", date: "2026-03-03", featured: 0 },
].map((article) => {
	const capture = JSON.parse(readFileSync(join(evidence, `${article.file}.json`), "utf8"));
	for (const field of ["url", "title", "html", "text"]) if (typeof capture[field] !== "string" || !capture[field].trim()) throw new Error(`${article.file}.json is missing ${field}.`);
	if (capture.url !== `https://deepankerseth.com/writing/${article.slug}`) throw new Error(`Unexpected source URL in ${article.file}.json.`);
	return { ...article, ...capture };
});

const schema = readFileSync(join(repo, "schema.sql"), "utf8");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = ["-- LOCAL DISPOSABLE TEST FIXTURE. Never apply to a remote database.", schema];
for (const article of articles) {
	const date = `${article.date}T00:00:00.000Z`;
	const columns = ["id", "slug", "title", "description", "content", "rendered_html", "tags", "status", "featured", "created_at", "updated_at", "published_at", "reading_excerpt"];
	const values = [`fixture-${article.slug}`, article.slug, article.title, "", article.text, article.html, "[]", "published", article.featured, date, date, date, null];
	sql.push(`INSERT INTO posts (${columns.join(", ")}) VALUES (${values.map(value => value === null ? "NULL" : quote(value)).join(", ")});`);
}

mkdirSync(persistence, { recursive: true });
const sqlFile = join(persistence, "fixture.sql");
writeFileSync(sqlFile, sql.join("\n\n"));
writeFileSync(join(persistence, "fixture-manifest.json"), JSON.stringify({
	purpose: "Disposable local browser-test content. Not a backup or production migration.",
	content: "Captured plain text is stored in content only for tests. It is not original or reconstructed Markdown. Do not use the editor to publish these rows.",
	rendered_html: "Preserved exactly from captured public essay HTML.",
	metadata: "Dates observed publicly. Descriptions and tags left empty. First two featured; reading excerpts left NULL. created_at/updated_at use publication date as fixture values.",
	articles: articles.map(({ url, title, slug, date }) => ({ url, title, slug, publication_date: date })),
}, null, 2));

const wrangler = join(repo, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(wrangler)) throw new Error("Install repository dependencies before running the fixture script.");
execFileSync(process.execPath, [wrangler, "d1", "execute", "personal-site-db", "--local", "--persist-to", persistence, "--file", sqlFile, "--config", join(repo, "wrangler.json")], {
	cwd: repo,
	stdio: "inherit",
	env: { ...process.env, WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false", WRANGLER_LOG_PATH: join(persistence, "wrangler.log") },
});
console.log(`Seeded ${articles.length} public-HTML fixtures into isolated local state: ${persistence}`);
console.log("No existing local or remote database was modified. See fixture-manifest.json for content limitations.");
