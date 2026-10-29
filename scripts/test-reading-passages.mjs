#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Exercise the live public-data contract. Retired prototype excerpt/fragment
// functions are deliberately not retained as a second implementation for tests.
const root = fileURLToPath(new URL('../', import.meta.url));
const bundled = await build({
  stdin: {
    contents: `export { literaryPost, htmlText, normalize, passageId, contextUrl, matches } from './src/site/literary/data.ts';
      export { isLongTitle, isPoetry } from './src/site/literary/typography.ts';`,
    resolveDir: root,
    sourcefile: 'reading-contracts.test-entry.ts',
    loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', logLevel: 'silent',
});
const { literaryPost, htmlText, normalize, passageId, contextUrl, matches, isLongTitle, isPoetry } =
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const expectations = [
  { file: 'meditations.json', slug: 'meditations', art: 0, quotes: [
    'Another layer, another issue, another knot.',
    'We often live at the level of abstractions, of flattering ideas about ourselves, and not at the level of direct observation. Meditation starts breaking that illusion.',
  ] },
  { file: 'war.json', slug: 'war', art: 1, quotes: [
    'The protagonist and the antagonist swap masks.',
    'I still hope that someday a protagonist will arise to end the civil war by gathering what is fractured into something whole.',
  ] },
  { file: 'abstractions.json', slug: 'abstractions-of-illusion', art: 2, quotes: [
    'Even the thought “I see the layers” can become another layer of illusion if I hold on to it.',
    'we experience ourselves as the chooser, yet the chooser is shaped by the very pattern it thinks it is choosing from.',
  ] },
  { file: 'i-am.json', slug: 'i-am', art: 3, quotes: [
    'I am boundless and yet I belong',
    'I am a magnificent moth of devotion to the absolute',
  ] },
];
const captures = await Promise.all(expectations.map(async expectation => {
  const url = new URL(`../tests/fixtures/public-captures/${expectation.file}`, import.meta.url);
  const bytes = await readFile(url);
  return { ...expectation, url, bytes, capture: JSON.parse(bytes.toString('utf8')) };
}));
const post = (slug, rendered_html, reading_excerpt = null, extra = {}) => Object.freeze({
  id: slug, slug, title: slug, description: '', content: '', rendered_html, reading_excerpt,
  tags: '[]', status: 'published', featured: 0, created_at: '2026-01-01', updated_at: '2026-01-01', published_at: '2026-01-01', ...extra,
});

for (const { slug, art, quotes, capture } of captures) {
  test(`${capture.title}: exact paired words, both destinations and original content`, () => {
    const input = post(slug, capture.html, null, { title: capture.title });
    const before = JSON.stringify(input);
    const result = literaryPost(input);
    assert.equal(result.title, capture.title);
    assert.equal(result.art, art);
    assert.deepEqual(result.quotes, quotes);
    for (const [index, quote] of quotes.entries()) {
      assert.ok(normalize(capture.text).includes(normalize(quote)), 'Words must occur in the independently captured publication');
      assert.equal(contextUrl(result, index), `/writing/${slug}?passage=${passageId(quote)}`);
    }
    assert.equal(JSON.stringify(input), before, 'Never annotate or rewrite stored prose');
  });
  test(`${capture.title}: choosing the second exact passage preserves its art relationship`, () => {
    const result = literaryPost(post(slug, capture.html, quotes[1]));
    assert.equal(result.art, art);
    assert.equal(result.initialReading, 1);
    assert.equal(result.excerpt, quotes[1]);
    assert.equal(contextUrl(result), `/writing/${slug}?passage=${passageId(quotes[1])}`);
  });
}

test('unrelated editorial summaries never borrow curated art or invent an exact context', () => {
  for (const { slug, capture } of captures) {
    const summary = 'An editorial introduction written separately from the essay.';
    const result = literaryPost(post(slug, capture.html, summary));
    assert.equal(result.art, null);
    assert.deepEqual(result.quotes, [summary]);
    assert.deepEqual(result.passageIds, ['']);
    assert.equal(contextUrl(result), `/writing/${slug}`);
  }
});

test('changed published writing cannot inherit a stale interpretation', () => {
  for (const { slug } of captures) {
    const opening = `The new published beginning for ${slug}.`;
    const input = post(slug, `<h2>A heading</h2><p>${opening}</p>`);
    const result = literaryPost(input);
    assert.equal(result.art, null);
    assert.deepEqual(result.quotes, [opening]);
    assert.equal(contextUrl(result), `/writing/${slug}?passage=${passageId(opening)}`);
    assert.equal(input.rendered_html, `<h2>A heading</h2><p>${opening}</p>`);
  }
});

test('an unknown piece owns its words, even if it shares a known passage', () => {
  const result = literaryPost(post('another-piece', captures[0].capture.html));
  assert.equal(result.art, null);
  assert.equal(result.quotes.length, 1);
  assert.ok(result.route.endsWith('/another-piece'));
});

test('inline markup, entities, authored IDs and poetry breaks preserve exact visible words', () => {
  const html = '<p id="author-māyā">A &amp; B <em>look</em> again.<br>Still&nbsp;here — māyā.</p>';
  const words = 'A & B look again. Still here — māyā.';
  const input = post('formatting', html, words);
  const result = literaryPost(input);
  assert.equal(htmlText(html), words);
  assert.equal(contextUrl(result), `/writing/formatting?passage=${passageId(words)}`);
  assert.equal(input.rendered_html, html, 'Context lookup does not replace the author ID or reserialize HTML');
});

test('a shortened opening is honestly linked to the whole piece, not a non-verbatim excerpt', () => {
  const opening = 'A long paragraph preserves its own words and their order. '.repeat(12);
  const result = literaryPost(post('long-opening', `<p>${opening}</p><p>Do not stitch this into the excerpt.</p>`));
  assert.ok(result.excerpt.length <= 261);
  assert.ok(result.excerpt.endsWith('…'));
  assert.ok(opening.startsWith(result.excerpt.slice(0, -1)));
  assert.equal(contextUrl(result), '/writing/long-opening');
});

test('empty visible content never creates a passage destination', () => {
  for (const html of ['', '   ', '<p> \n </p>']) {
    const result = literaryPost(post('empty', html));
    assert.equal(result.excerpt, '');
    assert.equal(contextUrl(result), '/writing/empty');
  }
});

test('invalid historical tags do not break a piece; search covers real body text', () => {
  for (const tags of ['broken-json', '{}', '[1,null,false]']) assert.deepEqual(literaryPost(post('tags', '<p>Quiet observation.</p>', null, { tags })).tags, []);
  const result = literaryPost(post('tags', '<p>Quiet observation.</p>', null, { tags: '["Attention",1]' }));
  assert.equal(matches(result, 'OBSERVATION', 'Attention'), true);
  assert.equal(matches(result, '', 'Different'), false);
});

test('passage identity normalizes spacing without losing Unicode or meaningful differences', () => {
  assert.equal(passageId('A\nB'), passageId(' A\u00a0B '));
  assert.notEqual(passageId('māyā'), passageId('maya'));
  const ids = expectations.flatMap(item => item.quotes.map(passageId));
  assert.equal(new Set(ids).size, 8);
  for (const id of ids) assert.match(id, /^p-[a-z0-9]+$/);
});

test('saved pages and unsaved previews share long-title and poetry thresholds', () => {
  assert.equal(isLongTitle('a'.repeat(40)), false);
  assert.equal(isLongTitle('a'.repeat(41)), true);
  assert.equal(isPoetry('<p>x<br>'.repeat(7)), false);
  assert.equal(isPoetry('<p>x<BR />'.repeat(8)), true);
  assert.equal(isPoetry(captures.find(item => item.slug === 'i-am').capture.html), true);
});

test('all original captured publications remain byte-for-byte unchanged', async () => {
  for (const { url, bytes } of captures) assert.deepEqual(await readFile(url), bytes);
});
