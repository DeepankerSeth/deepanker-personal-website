import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directories = ['src', 'public', 'migrations'];
const configuration = ['package.json', 'package-lock.json', 'astro.config.mjs', 'wrangler.json', 'schema.sql', 'tsconfig.json'];

async function filesWithin(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return filesWithin(path);
    if (entry.isFile()) return [path];
    throw new Error(`Source identity cannot silently omit a non-regular file: ${path}`);
  }))).flat();
}

// Guard the complete implementation, including registry, shared rendering and assets.
// Source identity is separate from the release report's served-build identity.
export async function sourceFingerprints() {
  const files = [...configuration, ...(await Promise.all(directories.map(filesWithin))).flat()].sort();
  return Object.fromEntries(await Promise.all(files.map(async path => [
    path, createHash('sha256').update(await readFile(join(root, path))).digest('hex'),
  ])));
}
