import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const versionRoots = {
	v1: path.join(rootDir, "src", "v1"),
	v2: path.join(rootDir, "src", "v2"),
};
const sourceExtensions = new Set([
	".astro",
	".js",
	".jsx",
	".mjs",
	".ts",
	".tsx",
]);
const importPatterns = [
	/import\s+[^"']*?\sfrom\s*["']([^"']+)["']/g,
	/export\s+[^"']*?\sfrom\s*["']([^"']+)["']/g,
	/import\(\s*["']([^"']+)["']\s*\)/g,
];

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
			continue;
		}

		if (sourceExtensions.has(path.extname(entry.name))) {
			files.push(fullPath);
		}
	}

	return files;
}

function resolveSpecifier(ownerFile, specifier) {
	if (specifier.startsWith(".")) {
		return path.resolve(path.dirname(ownerFile), specifier);
	}

	if (specifier.startsWith("src/")) {
		return path.resolve(rootDir, specifier);
	}

	if (specifier.startsWith("/src/")) {
		return path.resolve(rootDir, `.${specifier}`);
	}

	return null;
}

function* extractSpecifiers(source) {
	for (const pattern of importPatterns) {
		for (const match of source.matchAll(pattern)) {
			yield match[1];
		}
	}
}

function classifyOwner(filePath) {
	if (filePath.startsWith(versionRoots.v1)) return "v1";
	if (filePath.startsWith(versionRoots.v2)) return "v2";
	return null;
}

function crossesBoundary(owner, specifier, resolvedPath) {
	const disallowedRoot =
		owner === "v1" ? versionRoots.v2 : versionRoots.v1;
	const specifierPattern = owner === "v1" ? /(^|\/)v2(\/|$)/ : /(^|\/)v1(\/|$)/;

	return Boolean(
		(resolvedPath && resolvedPath.startsWith(disallowedRoot)) ||
			specifierPattern.test(specifier)
	);
}

async function main() {
	const files = [
		...(await walk(versionRoots.v1)),
		...(await walk(versionRoots.v2)),
	];
	const violations = [];

	for (const filePath of files) {
		const owner = classifyOwner(filePath);
		if (!owner) continue;

		const source = await readFile(filePath, "utf8");
		for (const specifier of extractSpecifiers(source)) {
			const resolvedPath = resolveSpecifier(filePath, specifier);
			if (crossesBoundary(owner, specifier, resolvedPath)) {
				violations.push({
					filePath: path.relative(rootDir, filePath),
					specifier,
				});
			}
		}
	}

	if (violations.length > 0) {
		console.error("Cross-version import boundary violation(s) found:");
		for (const violation of violations) {
			console.error(`- ${violation.filePath} -> ${violation.specifier}`);
		}
		process.exit(1);
	}

	console.log("Version boundary check passed: no src/v1 <-> src/v2 imports found.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
