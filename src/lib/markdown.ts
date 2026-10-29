// Server-side markdown rendering using marked + highlight.js

import { Marked } from "marked";
import markedFootnote, { type FootnoteRef, type Footnotes } from "marked-footnote";
import hljs from "highlight.js";

/** Only our renderers construct IDs; author-supplied footnote labels stay out of HTML attributes. */
export const FOOTNOTE_PREFIX = "essay-footnote-";

export function renderMarkdown(content: string, footnotePrefix = FOOTNOTE_PREFIX): string {
	if (!/^[a-z][a-z0-9-]*-$/.test(footnotePrefix)) throw new Error("Invalid footnote namespace.");
	const referenceId = (reference: FootnoteRef) =>
		`${footnotePrefix}ref-${reference.id}${reference.index ? `-${reference.index + 1}` : ""}`;
	// The extension owns mutable lexer state. A fresh instance keeps independent
	// preview/publication requests isolated, including after a failed parse.
	const marked = new Marked(markedFootnote(), {
		renderer: {
			code({ text, lang }: { text: string; lang?: string }) {
				const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
				const highlighted = hljs.highlight(text, { language }).value;
				return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
			},
		},
		extensions: [
			{
				name: "footnoteRef",
				renderer(token) {
					const reference = token as FootnoteRef;
					return `<sup><a id="${referenceId(reference)}" href="#${footnotePrefix}${reference.id}" data-footnote-ref="${footnotePrefix}" aria-describedby="${footnotePrefix}label">${reference.id}</a></sup>`;
				},
			},
			{
				name: "footnotes",
				renderer(token) {
					const { items } = token as Footnotes;
					if (!items.length) return "";
					const notes = items.map((note) => {
						const number = note.refs[0].id;
						const body = this.parser.parse(note.content).trimEnd();
						const backrefs = note.refs.map((reference) => {
							const occurrence = reference.index + 1;
							const label = `Back to reference ${number}${occurrence > 1 ? `, occurrence ${occurrence}` : ""}`;
							return `<a href="#${referenceId(reference)}" data-footnote-backref="${footnotePrefix}" aria-label="${label}">↩${occurrence > 1 ? `<sup>${occurrence}</sup>` : ""}</a>`;
						}).join(" ");
						const withBackrefs = body.endsWith("</p>")
							? `${body.slice(0, -4)} ${backrefs}</p>`
							: `${body}\n<p>${backrefs}</p>`;
						return `<li id="${footnotePrefix}${number}">\n${withBackrefs}\n</li>\n`;
					}).join("");
					return `<section class="footnotes" data-footnotes="${footnotePrefix}">\n<h2 id="${footnotePrefix}label">Footnotes</h2>\n<ol>\n${notes}</ol>\n</section>\n`;
				},
			},
		],
	});
	// A UTF-8 byte-order mark identifies the source encoding, not Markdown.
	// Ignore only an initial BOM for parsing; callers retain the untouched
	// source string for storage, conflict checks, publication and export.
	const result = marked.parse(content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content);
	if (typeof result === "string") return result;
	// No async extensions are installed.
	return "";
}

export function estimateReadingTime(content: string): number {
	const wordsPerMinute = 200;
	const words = content.trim().split(/\s+/).length;
	return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.substring(0, 80);
}
