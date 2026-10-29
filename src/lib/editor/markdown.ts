import { fromHtml } from 'hast-util-from-html';
import { sanitize, type Schema } from 'hast-util-sanitize';
import { toHtml } from 'hast-util-to-html';
import { FOOTNOTE_PREFIX, estimateReadingTime, renderMarkdown } from '../markdown';
import type { Element, Root } from 'hast';
import { validateDocument } from './validation';

/** The editor accepts prose HTML, never executable embeds or inline styling. */
const editorialSchema: Schema = {
	tagNames: [
		'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'em', 'strong', 'del', 's', 'a', 'ul', 'ol', 'li', 'blockquote',
		'pre', 'code', 'span', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
		'figure', 'figcaption', 'img', 'sup', 'sub', 'details', 'summary', 'kbd',
		'input', 'section',
	],
	strip: ['script', 'style', 'iframe', 'object', 'embed', 'template'],
	attributes: {
		a: ['href', 'title'],
		img: ['src', 'alt', 'title', 'width', 'height', ['loading', 'lazy', 'eager']],
		code: [['className', 'hljs', /^language-[a-zA-Z0-9_-]+$/]],
		span: [['className', /^hljs-[a-zA-Z0-9_-]+$/]],
		ol: ['start', 'reversed'],
		li: ['value'],
		th: ['colSpan', 'rowSpan', ['align', 'left', 'right', 'center'], 'scope'],
		td: ['colSpan', 'rowSpan', ['align', 'left', 'right', 'center']],
		details: ['open'],
		input: [['type', 'checkbox'], 'checked', 'disabled'],
	},
	protocols: { href: ['http', 'https', 'mailto'], src: ['http', 'https'] },
	required: { input: { type: 'checkbox', disabled: true } },
	clobberPrefix: 'essay-',
};

export function renderEditorialMarkdown(content: string): string {
	// A per-render namespace distinguishes generated footnotes from raw HTML.
	// It is removed before serialization, so preview and publish remain identical.
	const generated = `generated-footnote-${crypto.randomUUID()}-`;
	const noteId = new RegExp(`^${generated}[1-9][0-9]*$`);
	const referenceId = new RegExp(`^${generated}ref-[1-9][0-9]*(?:-[1-9][0-9]*)?$`);
	const schema: Schema = {
		...editorialSchema,
		attributes: {
			...editorialSchema.attributes,
			a: [
				...editorialSchema.attributes!.a,
				['id', referenceId], ['ariaDescribedBy', `${generated}label`],
				['ariaLabel', /^Back to reference [1-9][0-9]*(?:, occurrence [1-9][0-9]*)?$/],
				['dataFootnoteRef', generated], ['dataFootnoteBackref', generated],
			],
			li: [...editorialSchema.attributes!.li, ['id', noteId]],
			h2: [['id', `${generated}label`]],
			section: [['className', 'footnotes'], ['dataFootnotes', generated]],
		},
	};
	const tree = sanitize(fromHtml(renderMarkdown(content, generated), { fragment: true }), schema);
	const finishFootnotes = (parent: Root | Element) => {
		for (const node of parent.children) {
			if (node.type !== 'element') continue;
			const props = node.properties;
			// Sanitization retains its normal DOM-clobber prefix. Only IDs already
			// admitted above become the fixed, bounded public footnote namespace.
			if (typeof props.id === 'string' && props.id.startsWith(`essay-${generated}`)) {
				props.id = FOOTNOTE_PREFIX + props.id.slice(`essay-${generated}`.length);
			}
			if (Array.isArray(props.ariaDescribedBy)) {
				if (props.ariaDescribedBy.length) {
					props.ariaDescribedBy = props.ariaDescribedBy.map((id) =>
						id === `essay-${generated}label` ? `${FOOTNOTE_PREFIX}label` : id);
				} else delete props.ariaDescribedBy;
			}
			const isRef = props.dataFootnoteRef === generated;
			const isBackref = props.dataFootnoteBackref === generated;
			if ((isRef || isBackref) && typeof props.href === 'string' && props.href.startsWith(`#${generated}`)) {
				props.href = `#${FOOTNOTE_PREFIX}${props.href.slice(generated.length + 1)}`;
			}
			for (const attribute of ['dataFootnotes', 'dataFootnoteRef', 'dataFootnoteBackref']) {
				if (props[attribute] === generated) props[attribute] = '';
			}
			finishFootnotes(node);
		}
	};
	if (tree.type === 'root') finishFootnotes(tree);
	return toHtml(tree);
}

/** Pure preview: the same renderer used by publish, with no database access. */
export function previewDocument(value: unknown): { renderedHtml: string; readingMinutes: number } {
	const document = validateDocument(value);
	return {
		renderedHtml: renderEditorialMarkdown(document.content),
		readingMinutes: estimateReadingTime(document.content),
	};
}
