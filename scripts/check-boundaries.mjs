import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// The former v1/v2 guard now protects the actual architectural boundary:
// the public reading experience may be reused by private previews, never the reverse.
const root = process.cwd();
const extensions = new Set(['.astro', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.css']);
const imports = /(?:\b(?:import|export)\s+(?:[^"';]*?\s+from\s*)?|\bimport\s*\()(['"])([^'"]+)\1/g;

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (extensions.has(path.extname(file))) result.push(file);
  }
  return result;
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

const violations = [];
for (const file of await walk(path.join(root, 'src'))) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  for (const [, , specifier] of (await readFile(file, 'utf8')).matchAll(imports)) {
    if (!specifier.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), specifier.split('?')[0]);
    const targetRelative = path.relative(root, target).split(path.sep).join('/');
    if (/^src\/v[12](\/|$)/.test(targetRelative)) violations.push(`${relative}: retired implementation ${specifier}`);
    if (relative.startsWith('src/site/') && /^src\/(components\/editor|lib\/editor|lib\/auth|pages\/(admin|api))(\/|\.|$)/.test(targetRelative)) {
      violations.push(`${relative}: public reading imports private editor/auth code ${specifier}`);
    }
    const candidates = [target, ...['.ts', '.js', '.astro', '.css', '.mjs'].map(extension => target + extension), path.join(target, 'index.ts')];
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) violations.push(`${relative}: unresolved relative import ${specifier}`);
  }
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else console.log('Source boundary check passed: one public implementation, no private-editor imports, all relative imports resolve.');
