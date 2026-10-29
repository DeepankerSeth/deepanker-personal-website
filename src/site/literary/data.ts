import { fromHtml } from 'hast-util-from-html';
import type { Root, RootContent } from 'hast';
import type { Post } from '../../lib/db';
import { estimateReadingTime } from '../../lib/markdown';
import { artworks } from './artworks';
import { isPoetry } from './typography';

export const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(node: Root | RootContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element' && node.tagName === 'br') return '\n';
  const content = 'children' in node ? node.children.map(textOf).join('') : '';
  const block = node.type === 'element' &&
    ['p', 'div', 'section', 'article', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName);
  return block ? content + '\n' : content;
}

export function htmlText(html: string) {
  return normalize(textOf(fromHtml(html, { fragment: true })));
}

/** The browser uses the same normalized FNV-1a identity for exact passage arrival. */
export function passageId(text: string) {
  let hash = 2166136261;
  for (const char of normalize(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return 'p-' + (hash >>> 0).toString(36);
}

export function literaryPost(post: Post) {
  const tree = fromHtml(post.rendered_html, { fragment: true });
  const text = normalize(textOf(tree));
  const known = artworks.findIndex(artwork => artwork.slug === post.slug);
  const artwork = artworks[known];
  const explicit = normalize(post.reading_excerpt || '');
  const supported = artwork && artwork.passages.every(quote => text.includes(normalize(quote)));
  const explicitIndex = artwork ? artwork.passages.findIndex(quote => normalize(quote) === explicit) : -1;
  // Keep illustrations paired with the words they interpret. A changed body or
  // unrelated editorial excerpt must not silently inherit another interpretation.
  const art = supported && (!explicit || explicitIndex >= 0) ? known : null;
  const initialReading = art !== null && explicitIndex >= 0 ? explicitIndex : 0;

  const first = tree.children.find(node => node.type === 'element' && node.tagName === 'p' && normalize(textOf(node)));
  const paragraph = normalize(first ? textOf(first) : text);
  const opening = paragraph.length > 260 ? paragraph.slice(0, 260).replace(/\s+\S*$/, '') + '…' : paragraph;
  const selected = art !== null ? artworks[art].passages : [explicit || opening];
  const valid = selected.map(quote => Boolean(normalize(quote)) && text.includes(normalize(quote)));
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(post.tags);
    if (Array.isArray(parsed)) tags = parsed.filter((value): value is string => typeof value === 'string');
  } catch { /* Malformed historical metadata cannot prevent reading the piece. */ }

  return {
    id: post.id,
    slug: post.slug,
    route: '/writing/' + encodeURIComponent(post.slug),
    title: post.title,
    description: post.description || '',
    excerpt: selected[initialReading] || '',
    initialReading,
    quotes: selected,
    passageIds: selected.map((quote, index) => valid[index] ? passageId(quote) : ''),
    text,
    tags,
    minutes: estimateReadingTime(text),
    art,
    poetry: isPoetry(post.rendered_html),
    date: post.published_at || post.created_at,
  };
}

export type LiteraryPost = ReturnType<typeof literaryPost>;

export const matches = (post: LiteraryPost, query: string, tag: string) =>
  normalize(post.title + ' ' + post.description + ' ' + post.tags.join(' ') + ' ' + post.text)
    .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (!tag || post.tags.includes(tag));

export const contextUrl = (post: LiteraryPost, index = post.initialReading) =>
  post.route + (post.passageIds[index] ? '?passage=' + post.passageIds[index] : '');

export const displayDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});
