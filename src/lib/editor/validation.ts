import { COVER_ACCENTS, COVER_VARIANTS } from '../../shared/public/covers';
import { generateSlug } from '../markdown';
import { emptyDocument, type EditablePost } from './contracts';

export class EditorError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
		public fields?: Record<string, string>,
	) { super(message); }
}

export function objectInput(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new EditorError(400, 'invalid_input', 'Expected a JSON object.');
	}
	return value as Record<string, unknown>;
}

export function expectedVersion(value: unknown, field: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
		throw new EditorError(400, 'invalid_input', 'A valid version is required.', {
			[field]: 'Expected a non-negative integer.',
		});
	}
	return value;
}

export function creationId(value: unknown): string {
	if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
		throw new EditorError(400, 'invalid_input', 'A valid creation ID is required.');
	}
	return value;
}

export function validateDocument(value: unknown, publishing = false): EditablePost {
	const input = objectInput(value);
	const fields: Record<string, string> = {};
	const string = (key: string, limit: number, trim = true) => {
		const value = input[key] === undefined ? '' : input[key];
		if (typeof value !== 'string') {
			fields[key] = 'Expected text.';
			return '';
		}
		if (value.length > limit) fields[key] = `Use at most ${limit.toLocaleString('en-US')} characters.`;
		if (value.includes('\0')) fields[key] = 'Text cannot contain null characters.';
		return trim ? value.trim() : value;
	};
	const title = string('title', 300);
	const content = string('content', 1_000_000, false);
	const description = string('description', 1_000);
	const readingExcerpt = input.reading_excerpt == null ? null : string('reading_excerpt', 1_200) || null;
	const slug = string('slug', 120) || generateSlug(title);
	if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		fields.slug = 'Use lowercase letters, numbers, and single hyphens.';
	}
	const rawTags = input.tags === undefined ? [] : input.tags;
	let tags: string[] = [];
	if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== 'string')) {
		fields.tags = 'Expected a list of topic names.';
	} else {
		tags = [...new Set(rawTags.map((tag: string) => tag.trim()).filter(Boolean))];
		if (tags.length > 20 || tags.some((tag) => tag.length > 80 || tag.includes('\0'))) {
			fields.tags = 'Use up to 20 topics, each at most 80 characters.';
		}
	}
	const featured = input.featured === undefined ? false : input.featured;
	if (typeof featured !== 'boolean') fields.featured = 'Expected true or false.';
	const coverVariant = input.cover_variant ?? null;
	const coverAccent = input.cover_accent ?? null;
	if (coverVariant !== null && !(COVER_VARIANTS as readonly unknown[]).includes(coverVariant)) {
		fields.cover_variant = 'Choose a supported cover variant or Auto.';
	}
	if (coverAccent !== null && !(COVER_ACCENTS as readonly unknown[]).includes(coverAccent)) {
		fields.cover_accent = 'Choose a supported cover accent or Auto.';
	}
	if (publishing) {
		if (!title) fields.title = 'Add a title before publishing.';
		if (!content.trim()) fields.content = 'Add the essay before publishing.';
		if (!slug) fields.slug = 'Add a URL slug before publishing.';
	}
	if (Object.keys(fields).length) {
		throw new EditorError(422, 'validation_failed', 'Please check the highlighted fields.', fields);
	}
	return {
		title, slug, description, reading_excerpt: readingExcerpt, content, tags, featured: featured as boolean,
		cover_variant: coverVariant as EditablePost['cover_variant'],
		cover_accent: coverAccent as EditablePost['cover_accent'],
	};
}

/** Import is intentionally not a Markdown-to-text or frontmatter conversion. */
export function importMarkdown(content: string, metadata: EditablePost = emptyDocument()): EditablePost {
	if (typeof content !== 'string') {
		throw new EditorError(422, 'validation_failed', 'Choose a Markdown text file.', { content: 'Expected Markdown text.' });
	}
	return validateDocument({ ...metadata, content });
}

export function exportMarkdown(document: EditablePost): string {
	return document.content;
}
