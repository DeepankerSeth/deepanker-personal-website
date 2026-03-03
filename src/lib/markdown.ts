// Server-side markdown rendering using marked + highlight.js

import { Marked } from "marked";
import hljs from "highlight.js";

const marked = new Marked({
	renderer: {
		code({ text, lang }: { text: string; lang?: string }) {
			const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
			const highlighted = hljs.highlight(text, { language }).value;
			return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
		},
	},
});

export function renderMarkdown(content: string): string {
	const result = marked.parse(content);
	if (typeof result === "string") {
		return result;
	}
	// marked.parse can return a Promise if async extensions are used,
	// but we don't use any, so this is a safeguard
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
