import type { Post } from '../db';
import type { EditablePost, EditorDocument, EditorSummary } from './contracts';
import { renderEditorialMarkdown } from './markdown';
import { creationId, EditorError, expectedVersion, objectInput, validateDocument } from './validation';

interface StoredPost extends Post { revision: number; reading_excerpt: string | null }
interface DraftRow extends Omit<EditablePost, 'tags' | 'featured'> {
	id: string;
	tags: string;
	featured: number;
	base_revision: number;
	version: number;
	created_at: string;
	updated_at: string;
}

const draftColumns = 'id, base_revision, version, title, slug, description, reading_excerpt, content, tags, featured, cover_variant, cover_accent, created_at, updated_at';

function editable(row: StoredPost | DraftRow): EditablePost {
	let tags: string[] = [];
	try {
		const parsed: unknown = JSON.parse(row.tags);
		if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === 'string');
	} catch { /* A malformed legacy tag value must not make an essay uneditable. */ }
	return {
		title: row.title, slug: row.slug, description: row.description ?? '',
		reading_excerpt: row.reading_excerpt ?? null,
		content: row.content, tags, featured: row.featured === 1,
		cover_variant: row.cover_variant ?? null, cover_accent: row.cover_accent ?? null,
	};
}

function model(id: string, post: StoredPost | null, draft: DraftRow | null): EditorDocument {
	if (!post && !draft) throw new EditorError(404, 'not_found', 'This essay could not be found.');
	const document = editable((draft ?? post)!);
	const publishedRevision = post?.revision ?? 0;
	return {
		id, document, draftVersion: draft?.version ?? 0, publishedRevision,
		baseRevision: draft?.base_revision ?? publishedRevision,
		publicationStatus: post?.status ?? 'unpublished',
		hasUnpublishedChanges: !!draft && (!post || JSON.stringify(document) !== JSON.stringify(editable(post))),
		hasConflict: !!draft && draft.base_revision !== publishedRevision,
		savedAt: (draft ?? post)!.updated_at,
		publishedAt: post?.published_at ?? null,
	};
}

function readStatements(db: D1Database, id: string) {
	return [
		db.prepare('SELECT * FROM posts WHERE id = ?').bind(id),
		db.prepare('SELECT * FROM post_drafts WHERE id = ?').bind(id),
	];
}

function selectedRows(results: D1Result[]) {
	return {
		post: (results[0].results[0] as StoredPost | undefined) ?? null,
		draft: (results[1].results[0] as DraftRow | undefined) ?? null,
	};
}

async function rows(db: D1Database, id: string) {
	const { post, draft } = selectedRows(await db.batch(readStatements(db, id)));
	return { post, draft, current: model(id, post, draft) };
}

// D1 batches are transactions: the response observes this write and its
// triggers, never a subsequent writer's document or a mixed pair of rows.
async function writeAndRead(db: D1Database, id: string, statement: D1PreparedStatement) {
	const [write, ...selected] = await db.batch([statement, ...readStatements(db, id)]);
	requireChange(write.meta.changes);
	return selectedRows(selected);
}

function versions(current: EditorDocument, expectedDraft: number, expectedPublished: number, allowConflict = false) {
	if (current.draftVersion !== expectedDraft || current.publishedRevision !== expectedPublished || (!allowConflict && current.hasConflict)) {
		throw new EditorError(409, 'version_conflict', 'This essay changed elsewhere. Keep your text and reload the latest version before saving.');
	}
}

function requireChange(changes: number) {
	if (!changes) throw new EditorError(409, 'version_conflict', 'This essay changed while the request was saving. Your text has not been overwritten.');
}

function immutableSlug(post: StoredPost | null, document: EditablePost) {
	if (post && (post.published_at || post.status === 'published') && post.slug !== document.slug) {
		throw new EditorError(422, 'validation_failed', 'The URL of a published essay is permanent.', {
			slug: 'Keep the original published URL slug.',
		});
	}
}

function values(document: EditablePost) {
	return [
		document.title, document.slug, document.description, document.reading_excerpt, document.content,
		JSON.stringify(document.tags), document.featured ? 1 : 0,
		document.cover_variant, document.cover_accent,
	];
}

export async function getEditorDocument(db: D1Database, id: string): Promise<EditorDocument> {
	return (await rows(db, id)).current;
}

export async function listEditorPosts(db: D1Database): Promise<EditorSummary[]> {
	const [postResult, draftResult] = await db.batch<StoredPost | DraftRow>([
		db.prepare('SELECT * FROM posts'),
		db.prepare('SELECT * FROM post_drafts'),
	]);
	const posts = new Map((postResult.results as StoredPost[]).map((post) => [post.id, post]));
	const drafts = new Map((draftResult.results as DraftRow[]).map((draft) => [draft.id, draft]));
	return [...new Set([...posts.keys(), ...drafts.keys()])].map((id) => {
		const { document, ...rest } = model(id, posts.get(id) ?? null, drafts.get(id) ?? null);
		return { ...rest, title: document.title, slug: document.slug, description: document.description, tags: document.tags };
	}).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function createDraft(db: D1Database, value: unknown): Promise<EditorDocument> {
	const body = objectInput(value);
	const id = creationId(body.id);
	const document = validateDocument(body.document);
	const now = new Date().toISOString();
	// The client keeps the creation ID and immutable request across an uncertain
	// response. An exact first-version replay succeeds without another write;
	// different or subsequently edited content requires explicit reconciliation.
	const [, ...selected] = await db.batch([
		db.prepare(`INSERT INTO post_drafts (${draftColumns})
			SELECT ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
			WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id = ?)
			AND NOT EXISTS (SELECT 1 FROM post_drafts WHERE id = ?)`)
			.bind(id, ...values(document), now, now, id, id),
		...readStatements(db, id),
	]);
	const { post, draft } = selectedRows(selected);
	if (post || !draft || draft.version !== 1 || draft.base_revision !== 0 ||
		JSON.stringify(editable(draft)) !== JSON.stringify(document)) {
		throw new EditorError(409, 'creation_conflict', 'This creation ID already contains different or newer writing. Keep your text and open the saved version before continuing.');
	}
	return model(id, post, draft);
}

export async function saveDraft(db: D1Database, id: string, value: unknown): Promise<EditorDocument> {
	const body = objectInput(value);
	const document = validateDocument(body.document);
	const expectedDraft = expectedVersion(body.expectedDraftVersion, 'expectedDraftVersion');
	const expectedPublished = expectedVersion(body.expectedPublishedRevision, 'expectedPublishedRevision');
	const { post, draft, current } = await rows(db, id);
	versions(current, expectedDraft, expectedPublished);
	immutableSlug(post, document);
	const now = new Date().toISOString();
	const statement = draft
		? db.prepare(`UPDATE post_drafts
			SET title = ?, slug = ?, description = ?, reading_excerpt = ?, content = ?, tags = ?, featured = ?,
			cover_variant = ?, cover_accent = ?, updated_at = ?, version = version + 1
			WHERE id = ? AND version = ? AND base_revision = ?
			AND COALESCE((SELECT revision FROM posts WHERE id = ?), 0) = ?`)
			.bind(...values(document), now, id, expectedDraft, expectedPublished, id, expectedPublished)
		: db.prepare(`INSERT INTO post_drafts (${draftColumns})
			SELECT ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
			WHERE EXISTS (SELECT 1 FROM posts WHERE id = ? AND revision = ?)
			AND NOT EXISTS (SELECT 1 FROM post_drafts WHERE id = ?)`)
			.bind(id, expectedPublished, ...values(document), now, now, id, expectedPublished, id);
	const saved = await writeAndRead(db, id, statement);
	return model(id, saved.post, saved.draft);
}

export async function publishDraft(db: D1Database, id: string, value: unknown): Promise<EditorDocument> {
	const body = objectInput(value);
	const expectedDraft = expectedVersion(body.expectedDraftVersion, 'expectedDraftVersion');
	const expectedPublished = expectedVersion(body.expectedPublishedRevision, 'expectedPublishedRevision');
	const { post, draft, current } = await rows(db, id);
	versions(current, expectedDraft, expectedPublished);
	if (!draft) throw new EditorError(409, 'save_required', 'Save a working copy before publishing.');
	const document = validateDocument(editable(draft), true);
	immutableSlug(post, document);
	const html = renderEditorialMarkdown(document.content);
	const now = new Date().toISOString();
	// One guarded public-row statement publishes the whole snapshot. The schema
	// trigger rebases this exact draft in the same SQLite transaction.
	const statement = post
		? db.prepare(`UPDATE posts SET title = ?, slug = ?, description = ?, reading_excerpt = ?, content = ?,
			tags = ?, featured = ?, cover_variant = ?, cover_accent = ?, rendered_html = ?,
			status = 'published', updated_at = ?, published_at = COALESCE(published_at, ?), revision = revision + 1
			WHERE id = ? AND revision = ? AND EXISTS (
				SELECT 1 FROM post_drafts WHERE id = ? AND version = ? AND base_revision = ?
			)`)
			.bind(...values(document), html, now, now, id, expectedPublished, id, expectedDraft, expectedPublished)
		: db.prepare(`INSERT INTO posts
			(id, title, slug, description, reading_excerpt, content, tags, featured, cover_variant, cover_accent,
			rendered_html, status, created_at, updated_at, published_at, revision)
			SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', created_at, ?, ?, 1
			FROM post_drafts WHERE id = ? AND version = ? AND base_revision = 0
			AND NOT EXISTS (SELECT 1 FROM posts WHERE posts.id = post_drafts.id)`)
			.bind(...values(document), html, now, now, id, expectedDraft);
	const published = await writeAndRead(db, id, statement);
	return model(id, published.post, published.draft);
}

export async function unpublishPost(db: D1Database, id: string, value: unknown): Promise<EditorDocument> {
	const body = objectInput(value);
	const expectedDraft = expectedVersion(body.expectedDraftVersion, 'expectedDraftVersion');
	const expectedPublished = expectedVersion(body.expectedPublishedRevision, 'expectedPublishedRevision');
	const { post, current } = await rows(db, id);
	if (!post) throw new EditorError(409, 'not_published', 'This essay has not been published.');
	// Visibility may change while content has an unresolved base conflict, but
	// must not adopt an unseen private version into the caller's editor state.
	versions(current, expectedDraft, expectedPublished, true);
	const hidden = await writeAndRead(db, id,
		db.prepare(`UPDATE posts SET status = 'draft', updated_at = ?, revision = revision + 1
			WHERE id = ? AND revision = ?
			AND COALESCE((SELECT version FROM post_drafts WHERE id = ?), 0) = ?`)
			.bind(new Date().toISOString(), id, expectedPublished, id, expectedDraft));
	return model(id, hidden.post, hidden.draft);
}

/** Explicit user action only; a conflict never discards a working copy itself. */
export async function discardDraft(db: D1Database, id: string, value: unknown): Promise<EditorDocument | { deleted: true }> {
	const body = objectInput(value);
	const expectedDraft = expectedVersion(body.expectedDraftVersion, 'expectedDraftVersion');
	const expectedPublished = expectedVersion(body.expectedPublishedRevision, 'expectedPublishedRevision');
	const { post, draft, current } = await rows(db, id);
	if (!draft) {
		versions(current, expectedDraft, expectedPublished, true);
		return current;
	}
	// Discard intentionally also permits a conflicted base, but must still match
	// the versions the author reviewed, including the current public version.
	// An existing essay keeps a reset working copy and advances its version:
	// deleting and recreating it would reuse version 1 and admit stale writers.
	if (post) {
		const restored = await writeAndRead(db, id,
			db.prepare(`UPDATE post_drafts SET title = ?, slug = ?, description = ?, reading_excerpt = ?,
				content = ?, tags = ?, featured = ?, cover_variant = ?, cover_accent = ?,
				base_revision = ?, updated_at = ?, version = version + 1
				WHERE id = ? AND version = ?
				AND (SELECT revision FROM posts WHERE id = ?) = ?`)
				.bind(...values(editable(post)), expectedPublished, new Date().toISOString(), id, expectedDraft, id, expectedPublished));
		return model(id, restored.post, restored.draft);
	}
	const remaining = await writeAndRead(db, id,
		db.prepare(`DELETE FROM post_drafts WHERE id = ? AND version = ?
			AND COALESCE((SELECT revision FROM posts WHERE id = ?), 0) = ?`)
			.bind(id, expectedDraft, id, expectedPublished));
	return remaining.post ? model(id, remaining.post, remaining.draft) : { deleted: true };
}
