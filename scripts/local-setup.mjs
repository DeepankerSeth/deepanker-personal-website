#!/usr/bin/env node
/** Create fresh disposable local state. Never migrates or replaces an existing database. */
import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { ROOT, LOCAL, localStatePath, privateLocalDirectory } from './local-paths.mjs';

const args = process.argv.slice(2);
let requestedState = '.local/state';
let reviewWriting = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--state' && args[index + 1] && !args[index + 1].startsWith('--')) requestedState = args[++index];
  else if (args[index] === '--review-writing') reviewWriting = true;
  else if (args[index] === '--help') {
    console.log('Usage: node scripts/local-setup.mjs [--state NEW_LOCAL_OR_TEMP_DIRECTORY] [--review-writing]');
    process.exit(0);
  } else throw new Error(`Unknown or incomplete option: ${args[index]}`);
}

const state = localStatePath(requestedState);
const wrangler = join(ROOT, 'node_modules/wrangler/bin/wrangler.js');
if (!existsSync(wrangler)) throw new Error('Run npm ci before setting up local state.');
const varsPath = join(ROOT, '.dev.vars');
const loginPath = join(LOCAL, 'development-login.txt');
if (existsSync(varsPath) && !lstatSync(varsPath).isFile()) throw new Error('.dev.vars must be a regular local file.');
if (!existsSync(varsPath) && existsSync(loginPath)) {
  throw new Error('A local login note exists without .dev.vars. Preserve or remove that obsolete note explicitly before generating new credentials.');
}
process.umask(0o077);
privateLocalDirectory();
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false' };
if (reviewWriting) {
  execFileSync('python3', [join(ROOT, 'scripts/release-review-fixture.py'), '--persist-to', state], { cwd: ROOT, env, stdio: 'inherit' });
} else {
  mkdirSync(state, { recursive: true, mode: 0o700 });
  execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'personal-site-db',
    '--local', '--persist-to', state, '--file', join(ROOT, 'schema.sql'), '--config', join(ROOT, 'wrangler.json')], {
    cwd: ROOT, env: { ...env, WRANGLER_LOG_PATH: join(state, 'wrangler.log') }, stdio: 'inherit',
  });
}

const credentialsCreated = !existsSync(varsPath);
if (credentialsCreated) {
  const password = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(password).digest('hex');
  const secret = randomBytes(32).toString('hex');
  writeFileSync(varsPath, `# Local development only. Never upload or reuse for production.\nADMIN_PASSWORD_HASH=${hash}\nJWT_SECRET=${secret}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(loginPath, `LOCAL DEVELOPMENT ONLY\n\nPassword: ${password}\n\nSign in at /admin/login on your local server. Do not commit, upload or reuse these credentials.\n`, { flag: 'wx', mode: 0o600 });
}
writeFileSync(join(state, 'setup.json'), JSON.stringify({
  createdAt: new Date().toISOString(), kind: reviewWriting ? 'public-html-review-with-private-qa' : 'empty-development',
  localOnly: true, productionBackup: false,
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ state, reviewWriting, credentialsCreated,
  loginFile: credentialsCreated ? loginPath : 'Existing .dev.vars kept; use its existing local password.',
  next: 'Run npm run build, then npm run serve:local (pass -- --state PATH when using a custom state directory).',
}, null, 2));
