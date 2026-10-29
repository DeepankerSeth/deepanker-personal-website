#!/usr/bin/env node
/** Serve the built Worker using local D1 only; never builds, deploys or migrates. */
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { ROOT, localStatePath, privateLocalDirectory } from './local-paths.mjs';

let requestedState = '.local/state';
let port = 4194;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--state' && args[index + 1] && !args[index + 1].startsWith('--')) requestedState = args[++index];
  else if (args[index] === '--port' && args[index + 1]) port = Number(args[++index]);
  else if (args[index] === '--help') {
    console.log('Usage: node scripts/local-serve.mjs [--state EXISTING_LOCAL_OR_TEMP_DIRECTORY] [--port 4194]');
    process.exit(0);
  } else throw new Error(`Unknown or incomplete option: ${args[index]}`);
}
if (!Number.isInteger(port) || port < 1024 || port > 64535) throw new Error('Choose a local port between 1024 and 64535 (the inspector uses port+1000).');
const state = localStatePath(requestedState, { existing: true });
const builtDirectory = join(ROOT, 'dist/server');
const generatedPath = join(builtDirectory, 'wrangler.json');
const varsPath = join(ROOT, '.dev.vars');
if (!existsSync(generatedPath)) throw new Error('Run npm run build before serving the checked build.');
if (!existsSync(varsPath) || !lstatSync(varsPath).isFile()) throw new Error('A regular local .dev.vars file is required. Run setup:local in a fresh checkout.');
const built = JSON.parse(readFileSync(generatedPath, 'utf8'));
const main = resolve(builtDirectory, built.main);
const assets = resolve(builtDirectory, built.assets.directory);
if (assets !== join(ROOT, 'dist/client') || !existsSync(main)) throw new Error('The generated Worker entry/assets do not match this build.');

// Refuse an occupied port instead of quietly serving another instance elsewhere.
for (const candidate of [port, port + 1000]) {
  await new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', () => fail(new Error(`Local port ${candidate} is already in use. Choose another --port or stop only your owned server.`)));
    probe.listen(candidate, '127.0.0.1', () => probe.close(done));
  });
}
const runtime = join(privateLocalDirectory(), `serve-${port}`);
mkdirSync(runtime, { recursive: true, mode: 0o700 });
if (!lstatSync(runtime).isDirectory() || lstatSync(runtime).isSymbolicLink()) throw new Error('The generated local runtime directory must not be a symlink.');
chmodSync(runtime, 0o700);
const config = {
  name: built.name, main, compatibility_date: built.compatibility_date,
  compatibility_flags: built.compatibility_flags, rules: built.rules, no_bundle: true,
  assets: { ...built.assets, directory: assets }, vars: built.vars,
  d1_databases: built.d1_databases.map(database => ({
    ...database, remote: false,
    migrations_dir: resolve(builtDirectory, database.migrations_dir || '../../migrations'),
  })),
};
const configPath = join(runtime, 'wrangler.json');
for (const file of [configPath, join(runtime, '.dev.vars')]) {
  try {
    if (!lstatSync(file).isFile()) throw new Error(`Generated runtime files must not be symlinks or directories: ${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
chmodSync(configPath, 0o600);
copyFileSync(varsPath, join(runtime, '.dev.vars'));
chmodSync(join(runtime, '.dev.vars'), 0o600);
console.log(`Local built website: http://127.0.0.1:${port}/\nState: ${state}\nOnly dist/client is public. Ctrl-C stops this server.`);
const child = spawn(process.execPath, [join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'dev',
  '--config', configPath, '--local', '--ip', '127.0.0.1', '--port', String(port),
  '--inspector-port', String(port + 1000), '--persist-to', state], {
  cwd: runtime, stdio: 'inherit', env: {
    ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false',
    WRANGLER_LOG_PATH: join(runtime, 'wrangler.log'),
  },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
