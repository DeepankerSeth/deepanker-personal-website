import { chmodSync, existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL = join(ROOT, '.local');

const inside = (root, path) => {
  const suffix = relative(root, path);
  return suffix !== '' && !suffix.startsWith('..') && !isAbsolute(suffix);
};

/** Resolve missing suffixes too: a symlink in an existing parent must not escape. */
function canonicalTarget(path) {
  let ancestor = path;
  while (true) {
    try { lstatSync(ancestor); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ancestor = dirname(ancestor);
    }
  }
  return resolve(realpathSync(ancestor), relative(ancestor, path));
}

export function localStatePath(value, { existing = false } = {}) {
  const path = resolve(ROOT, value);
  if (existsSync(LOCAL) && lstatSync(LOCAL).isSymbolicLink()) {
    throw new Error('.local must be a real directory, not a symlink.');
  }
  const roots = [canonicalTarget(LOCAL), ...new Set([tmpdir(), '/tmp'].filter(existsSync).map(path => realpathSync(path)))];
  if (!roots.some(root => inside(root, canonicalTarget(path)))) {
    throw new Error('Local state must be inside this project’s .local directory or temporary storage.');
  }
  if (existsSync(path)) {
    if (!existing) throw new Error(`Refusing to modify existing state: ${path}. Choose a new --state directory.`);
    if (!lstatSync(path).isDirectory()) throw new Error('Local state must be a real directory, not a file or symlink.');
  } else if (existing) throw new Error(`Local state does not exist: ${path}. Run setup:local first.`);
  return path;
}

export function privateLocalDirectory() {
  if (existsSync(LOCAL) && (!lstatSync(LOCAL).isDirectory() || lstatSync(LOCAL).isSymbolicLink())) {
    throw new Error('.local must be a real directory.');
  }
  mkdirSync(LOCAL, { recursive: true, mode: 0o700 });
  chmodSync(LOCAL, 0o700);
  return LOCAL;
}
