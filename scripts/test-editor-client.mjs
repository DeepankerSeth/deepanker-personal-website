import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { build } from 'esbuild';

// Execute the actual client and its imports. Controls/events below are deliberately
// small test doubles, not a browser, layout engine, or implementation of the API.
const clientPath = fileURLToPath(new URL('../src/components/editor/editor-client.ts', import.meta.url));
const markup = await readFile(new URL('../src/components/editor/PostEditor.astro', import.meta.url), 'utf8');
const controlIds = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const bundled = await build({
	entryPoints: [clientPath], bundle: true, write: false,
	format: 'iife', platform: 'browser', target: 'es2022',
});
const client = new Script(bundled.outputFiles[0].text, { filename: 'editor-client.test-bundle.js' });
const emptyDocument = () => ({
	title: '', slug: '', description: '', reading_excerpt: null, content: '', tags: [],
	featured: false, cover_variant: null, cover_accent: null,
});

class Control {
	constructor(id = '') {
		Object.assign(this, {
			id, value: '', textContent: '', hidden: true, disabled: false, checked: false,
			dataset: {}, attributes: new Map(), listeners: new Map(), children: [],
			classList: { toggle() {} },
		});
	}
	get childElementCount() { return this.children.length; }
	addEventListener(type, listener) {
		if (!this.listeners.has(type)) this.listeners.set(type, []);
		this.listeners.get(type).push(listener);
	}
	dispatch(type, event = {}) {
		return (this.listeners.get(type) ?? []).map((listener) => listener(event));
	}
	getAttribute(name) { return this.attributes.get(name) ?? null; }
	setAttribute(name, value) { this.attributes.set(name, value); }
	removeAttribute(name) { this.attributes.delete(name); }
	replaceChildren() { this.children = []; }
	appendChild(child) { this.children.push(child); }
	focus() {}
	scrollIntoView() {}
}

function boot({
	storage = new Map(), history = { state: null, url: '/admin/posts/new' },
	current = null, storageBlocked = false,
} = {}) {
	const controls = new Map(controlIds.map((id) => [id, new Control(id)]));
	const get = (id) => {
		assert.ok(controls.has(id), `Client requested an ID absent from PostEditor.astro: ${id}`);
		return controls.get(id);
	};
	const root = new Control('editor-root');
	const workbench = new Control('workbench');
	root.querySelector = (selector) => {
		assert.equal(selector, '.editor-workbench');
		return workbench;
	};
	root.querySelectorAll = (selector) => {
		assert.equal(selector, '[data-editor-mode]');
		return []; // Preview/tab interaction is outside this test's scope.
	};
	get('post-form').querySelectorAll = (selector) => {
		assert.equal(selector, '[aria-invalid]');
		return [...controls.values()].filter((control) => control.getAttribute('aria-invalid'));
	};
	get('editor-initial').textContent = JSON.stringify(current);
	const initial = current?.document ?? emptyDocument();
	for (const [property, id] of Object.entries({
		title: 'post-title', slug: 'post-slug', description: 'post-description',
		reading_excerpt: 'post-excerpt', content: 'post-content',
	})) get(id).value = initial[property] ?? '';
	get('post-tags').value = initial.tags.join(', ');
	get('post-featured').checked = initial.featured;

	const calls = [];
	const responses = [];
	const unexpectedRequests = [];
	const confirmations = [];
	let confirmResult = true;
	const documentEvents = new Control();
	const windowEvents = new Control();
	const checkStorage = () => { if (storageBlocked) throw new Error('Test storage is blocked'); };
	const context = {
		console, Blob, URL, TextDecoder, setTimeout, clearTimeout,
		document: {
			querySelector(selector) { assert.equal(selector, '[data-post-editor]'); return root; },
			getElementById: get, createElement: () => new Control(), title: '', activeElement: null,
			addEventListener: documentEvents.addEventListener.bind(documentEvents),
		},
		window: { addEventListener: windowEvents.addEventListener.bind(windowEvents) },
		history: {
			get state() { return history.state; },
			replaceState(state, _unused, url) { history.state = state; if (url) history.url = url; },
		},
		crypto: { randomUUID },
		sessionStorage: {
			getItem(key) { checkStorage(); return storage.get(key) ?? null; },
			setItem(key, value) { checkStorage(); storage.set(key, value); },
			removeItem(key) { checkStorage(); storage.delete(key); },
		},
		matchMedia: () => ({ matches: false, addEventListener() {} }),
		location: { origin: 'http://editor.test' },
		confirm(message) { confirmations.push(message); return confirmResult; },
		async fetch(url, options) {
			const call = { url, method: options.method, body: JSON.parse(options.body) };
			calls.push(call);
			if (!responses.length) {
				unexpectedRequests.push(call);
				throw new Error(`Unexpected request: ${options.method} ${url}`);
			}
			const response = responses.shift();
			return typeof response === 'function' ? response(call) : response;
		},
	};
	client.runInNewContext(context);

	async function dispatch(id, type = 'click') {
		await Promise.all(get(id).dispatch(type, { preventDefault() {} }));
		// Save handlers intentionally return void. Wait for their observable busy
		// state instead of sleeping a fixed duration or reaching into private state.
		for (let turn = 0; root.getAttribute('aria-busy') === 'true' && turn < 100; turn++) await setImmediate();
		assert.notEqual(root.getAttribute('aria-busy'), 'true', 'Editor operation did not settle');
		assert.deepEqual(unexpectedRequests, [], 'Client sent an unscripted request');
		assert.equal(responses.length, 0, 'Client did not consume all expected responses');
	}
	return {
		get, root, storage, history, calls, responses, confirmations, dispatch,
		setConfirm(value) { confirmResult = value; },
		input(id, value) {
			const control = get(id);
			control.value = value;
			control.dispatch('input', { target: control });
			get('editor-fields').dispatch('input', { target: control });
		},
		attemptLeave() {
			let prevented = false;
			windowEvents.dispatch('beforeunload', { preventDefault() { prevented = true; } });
			return prevented;
		},
	};
}

const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const reject = (status, code) => reply(status, { error: `Scripted ${code}`, code });
const connectionLost = () => { throw new TypeError('Scripted lost response'); };
const save = (editor) => editor.dispatch('post-form', 'submit');
const hasPendingCreation = (editor) => [...editor.storage.keys()].some((key) => key.startsWith('writing-room:pending-creation:'));
// Canned server acknowledgments support client state assertions. The real
// validation/normalization and D1 semantics are covered by test:editor instead.
const snapshot = (id, document, draftVersion = 1) => ({
	id, document: { ...document, slug: document.slug || 'saved-piece' }, draftVersion,
	publishedRevision: 0, baseRevision: 0, publicationStatus: 'unpublished',
	hasUnpublishedChanges: true, hasConflict: false,
	savedAt: '2026-10-17T01:00:00Z', publishedAt: null,
});
const acknowledgeCreate = (call) => reply(201, snapshot(call.body.id, call.body.document));
const acknowledgePut = (id) => (call) => reply(200, snapshot(id, call.body.document, 2));

async function failFirstCreate(editor, { title = 'Original', content = 'Original text' } = {}) {
	editor.input('post-title', title);
	editor.input('post-content', content);
	editor.responses.push(connectionLost);
	await save(editor);
	assert.equal(editor.calls[0].method, 'POST');
	assert.equal(editor.calls[0].url, '/api/editor/posts');
	return editor.calls[0];
}

test('lost creation response replays the identical request before saving newer text', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor, { content: '\ufefffirst\r\nsecond\r\n' });
	editor.input('post-title', 'Newer title');
	editor.input('post-content', '\ufeffnew\r\ntext\r\n');
	editor.responses.push(acknowledgeCreate, acknowledgePut(first.body.id));
	await save(editor);
	assert.deepEqual(editor.calls[1].body, first.body);
	assert.equal(editor.calls[2].method, 'PUT');
	assert.equal(editor.calls[2].body.document.content, '\ufeffnew\r\ntext\r\n');
	assert.equal(editor.get('post-title').value, 'Newer title');
	assert.equal(editor.get('post-content').value, '\ufeffnew\r\ntext\r\n');
	assert.equal(editor.storage.size, 0);
	assert.equal(editor.history.url, `/admin/posts/${first.body.id}/edit`);
});

test('reload restores latest local text while retrying the original creation snapshot', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor);
	editor.input('post-content', 'Latest text');
	const reloaded = boot({ storage: editor.storage, history: editor.history });
	assert.equal(reloaded.get('post-content').value, 'Latest text');
	reloaded.responses.push(acknowledgeCreate, acknowledgePut(first.body.id));
	await save(reloaded);
	assert.deepEqual(reloaded.calls[0].body, first.body);
	assert.equal(reloaded.calls[1].body.document.content, 'Latest text');
});

test('a fresh history entry never adopts another piece’s pending creation', async () => {
	const oldEditor = boot();
	const old = await failFirstCreate(oldEditor);
	const fresh = boot({ storage: oldEditor.storage });
	assert.equal(fresh.get('post-title').value, '');
	fresh.input('post-title', 'Different piece');
	fresh.responses.push(acknowledgeCreate);
	await save(fresh);
	assert.notEqual(fresh.calls[0].body.id, old.body.id);
	assert.equal(fresh.calls[0].body.document.title, 'Different piece');
});

test('a known first validation rejection releases the snapshot for corrections', async () => {
	const editor = boot();
	editor.input('post-title', 'Invalid title');
	editor.responses.push(reject(400, 'invalid_input'));
	await save(editor);
	const firstId = editor.calls[0].body.id;
	assert.equal(hasPendingCreation(editor), false);
	editor.input('post-title', 'Corrected title');
	editor.responses.push(acknowledgeCreate);
	await save(editor);
	assert.equal(editor.calls[1].body.id, firstId, 'A known no-write rejection can safely reuse this piece’s ID');
	assert.equal(editor.calls[1].body.document.title, 'Corrected title');
});

test('later validation cannot discard an already uncertain creation', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor);
	editor.input('post-title', 'Edited title');
	editor.responses.push(reject(400, 'invalid_input'));
	await save(editor);
	assert.deepEqual(editor.calls[1].body, first.body);
	assert.equal(hasPendingCreation(editor), true);
	assert.equal(editor.get('conflict-actions').hidden, false);
	assert.equal(editor.get('open-latest').href, `/admin/posts/${first.body.id}/edit`);
});

test('creation conflict offers comparison without a GET or silent adoption', async () => {
	const editor = boot();
	editor.input('post-title', 'Conflicting writing');
	editor.responses.push(reject(409, 'creation_conflict'));
	await save(editor);
	assert.equal(editor.get('conflict-actions').hidden, false);
	assert.equal(editor.get('post-title').value, 'Conflicting writing');
	assert.equal(hasPendingCreation(editor), true);
	assert.equal(editor.calls.length, 1);
});

test('authentication failure retains the original pending request', async () => {
	const editor = boot();
	editor.input('post-title', 'Awaiting sign in');
	editor.responses.push(reject(401, 'unauthorized'));
	await save(editor);
	assert.equal(hasPendingCreation(editor), true);
	assert.equal(editor.get('session-actions').hidden, false);
});

test('malformed success remains uncertain', async () => {
	const editor = boot();
	editor.input('post-title', 'Malformed response');
	editor.responses.push(reply(201, null));
	await save(editor);
	const pendingKey = [...editor.storage.keys()].find((key) => key.startsWith('writing-room:pending-creation:'));
	assert.ok(pendingKey);
	assert.equal(JSON.parse(editor.storage.get(pendingKey)).uncertain, true);
	assert.equal(editor.history.url, '/admin/posts/new');
});

test('blocked storage preserves the same in-memory request for retry', async () => {
	const editor = boot({ storageBlocked: true });
	const first = await failFirstCreate(editor);
	editor.responses.push(acknowledgeCreate);
	await save(editor);
	assert.deepEqual(editor.calls[1].body, first.body);
	assert.equal(editor.history.url, `/admin/posts/${first.body.id}/edit`);
});

test('recovery restore confirms before replacing newer unsaved text', async () => {
	const storage = new Map([['writing-room:recovery:new', JSON.stringify({
		document: { ...emptyDocument(), title: 'Recovered title', content: 'Recovered text' },
	})]]);
	const editor = boot({ storage });
	assert.equal(editor.get('recovery-notice').hidden, false);
	editor.input('post-content', 'Typed now');
	editor.setConfirm(false);
	await editor.dispatch('restore-recovery');
	assert.equal(editor.get('post-content').value, 'Typed now');
	assert.equal(editor.confirmations.length, 1);
	editor.setConfirm(true);
	await editor.dispatch('restore-recovery');
	assert.equal(editor.get('post-content').value, 'Recovered text');
});

test('publish waits for original create replay and the newer-text PUT', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor);
	editor.input('post-content', 'Latest version to publish');
	let saved;
	editor.responses.push(
		acknowledgeCreate,
		(call) => { saved = snapshot(first.body.id, call.body.document, 2); return reply(200, saved); },
		() => reply(200, { ...saved, publishedRevision: 1, baseRevision: 1, publicationStatus: 'published', publishedAt: saved.savedAt }),
	);
	await editor.dispatch('publish-post');
	assert.deepEqual(editor.calls.map((call) => call.method), ['POST', 'POST', 'PUT', 'POST']);
	assert.equal(editor.calls[3].url, `/api/editor/posts/${first.body.id}/publish`);
	assert.equal(editor.calls[3].body.expectedDraftVersion, 2);
	assert.equal(saved.document.content, 'Latest version to publish');
});

test('failed follow-up PUT preserves newer text at the known ID across reload', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor);
	editor.input('post-content', 'Unsaved latest text');
	let created;
	editor.responses.push(
		(call) => { created = snapshot(call.body.id, call.body.document); return reply(201, created); },
		connectionLost,
	);
	await save(editor);
	assert.equal(editor.history.url, `/admin/posts/${first.body.id}/edit`);
	assert.equal(editor.get('post-content').value, 'Unsaved latest text');
	assert.equal(hasPendingCreation(editor), false);
	const reloaded = boot({ storage: editor.storage, history: editor.history, current: created });
	assert.equal(reloaded.get('recovery-notice').hidden, false);
	await reloaded.dispatch('restore-recovery');
	assert.equal(reloaded.get('post-content').value, 'Unsaved latest text');
	reloaded.responses.push(acknowledgePut(first.body.id));
	await save(reloaded);
	assert.equal(reloaded.calls[0].method, 'PUT');
});

test('intentionally empty edits survive unresolved-create reload and validation', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor);
	editor.input('post-title', '');
	editor.input('post-content', '');
	assert.equal(editor.root.dataset.dirty, 'true');
	assert.equal(editor.attemptLeave(), true);
	const reloaded = boot({ storage: editor.storage, history: editor.history });
	assert.equal(reloaded.get('post-title').value, '');
	assert.equal(reloaded.get('post-content').value, '');
	reloaded.responses.push(acknowledgeCreate, reject(422, 'validation_error'));
	await save(reloaded);
	assert.deepEqual(reloaded.calls[0].body, first.body);
	assert.equal(reloaded.calls[1].method, 'PUT');
	assert.equal(reloaded.calls[1].body.document.content, '');
	assert.equal(reloaded.get('post-content').value, '');
});

test('definitive first auth failure then reload and validation can release the snapshot', async () => {
	const editor = boot();
	editor.input('post-title', 'Needs correction');
	editor.responses.push(reject(401, 'unauthorized'));
	await save(editor);
	const first = editor.calls[0];
	const reloaded = boot({ storage: editor.storage, history: editor.history });
	reloaded.responses.push(reject(422, 'validation_error'));
	await save(reloaded);
	assert.deepEqual(reloaded.calls[0].body, first.body);
	assert.equal(hasPendingCreation(reloaded), false);
	reloaded.input('post-title', 'Corrected after sign in');
	reloaded.responses.push(acknowledgeCreate);
	await save(reloaded);
	assert.equal(reloaded.calls[1].body.id, first.body.id);
	assert.equal(reloaded.calls[1].body.document.title, 'Corrected after sign in');
});

test('earlier uncertainty remains sticky across auth, reload, and validation failure', async () => {
	const editor = boot();
	const first = await failFirstCreate(editor);
	editor.responses.push(reject(401, 'unauthorized'));
	await save(editor);
	const reloaded = boot({ storage: editor.storage, history: editor.history });
	reloaded.responses.push(reject(422, 'validation_error'));
	await save(reloaded);
	assert.deepEqual(reloaded.calls[0].body, first.body);
	assert.equal(hasPendingCreation(reloaded), true);
});

test('blocked-storage reload retains identity so changed text conflicts instead of duplicating', async () => {
	const editor = boot({ storageBlocked: true });
	const first = await failFirstCreate(editor);
	assert.match(editor.get('editor-message-text').textContent, /Local recovery is unavailable/);
	const reloaded = boot({ history: editor.history, storageBlocked: true });
	reloaded.input('post-title', 'Different replacement');
	reloaded.responses.push(reject(409, 'creation_conflict'));
	await save(reloaded);
	assert.equal(reloaded.calls[0].body.id, first.body.id);
	assert.equal(reloaded.get('conflict-actions').hidden, false);
	assert.equal(reloaded.calls.length, 1);
});
