// Database helper functions for Cloudflare D1

export interface Post {
	id: string;
	slug: string;
	title: string;
	description: string;
	content: string;
	rendered_html: string;
	tags: string; // JSON array string
	status: "draft" | "published";
	featured: number;
	created_at: string;
	updated_at: string;
	published_at: string | null;
}

export interface CreatePostInput {
	title: string;
	slug: string;
	description: string;
	content: string;
	rendered_html: string;
	tags: string[];
	status: "draft" | "published";
	featured: boolean;
}

export interface UpdatePostInput {
	title?: string;
	slug?: string;
	description?: string;
	content?: string;
	rendered_html?: string;
	tags?: string[];
	status?: "draft" | "published";
	featured?: boolean;
}

function generateId(): string {
	return crypto.randomUUID();
}

export function parseTags(tagsJson: string): string[] {
	try {
		return JSON.parse(tagsJson);
	} catch {
		return [];
	}
}

// ── Public queries ──────────────────────────────────────────────

export async function getAllPublishedPosts(db: D1Database): Promise<Post[]> {
	const result = await db
		.prepare(
			"SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC"
		)
		.all<Post>();
	return result.results;
}

export async function getFeaturedPosts(db: D1Database): Promise<Post[]> {
	const result = await db
		.prepare(
			"SELECT * FROM posts WHERE status = 'published' AND featured = 1 ORDER BY published_at DESC LIMIT 5"
		)
		.all<Post>();
	return result.results;
}

export async function getPostBySlug(
	db: D1Database,
	slug: string
): Promise<Post | null> {
	const result = await db
		.prepare(
			"SELECT * FROM posts WHERE slug = ? AND status = 'published'"
		)
		.bind(slug)
		.first<Post>();
	return result ?? null;
}

export async function getUniqueTags(db: D1Database): Promise<string[]> {
	const posts = await getAllPublishedPosts(db);
	const tagSet = new Set<string>();
	for (const post of posts) {
		for (const tag of parseTags(post.tags)) {
			tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort();
}

// ── Admin queries ───────────────────────────────────────────────

export async function getAllPosts(db: D1Database): Promise<Post[]> {
	const result = await db
		.prepare("SELECT * FROM posts ORDER BY updated_at DESC")
		.all<Post>();
	return result.results;
}

export async function getPostById(
	db: D1Database,
	id: string
): Promise<Post | null> {
	const result = await db
		.prepare("SELECT * FROM posts WHERE id = ?")
		.bind(id)
		.first<Post>();
	return result ?? null;
}

export async function createPost(
	db: D1Database,
	input: CreatePostInput
): Promise<Post> {
	const id = generateId();
	const now = new Date().toISOString();
	const publishedAt =
		input.status === "published" ? now : null;

	await db
		.prepare(
			`INSERT INTO posts (id, slug, title, description, content, rendered_html, tags, status, featured, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			id,
			input.slug,
			input.title,
			input.description,
			input.content,
			input.rendered_html,
			JSON.stringify(input.tags),
			input.status,
			input.featured ? 1 : 0,
			now,
			now,
			publishedAt
		)
		.run();

	return (await getPostById(db, id))!;
}

export async function updatePost(
	db: D1Database,
	id: string,
	input: UpdatePostInput
): Promise<Post | null> {
	const existing = await getPostById(db, id);
	if (!existing) return null;

	const now = new Date().toISOString();
	const title = input.title ?? existing.title;
	const slug = input.slug ?? existing.slug;
	const description = input.description ?? existing.description;
	const content = input.content ?? existing.content;
	const rendered_html = input.rendered_html ?? existing.rendered_html;
	const tags =
		input.tags !== undefined
			? JSON.stringify(input.tags)
			: existing.tags;
	const status = input.status ?? existing.status;
	const featured =
		input.featured !== undefined
			? input.featured
				? 1
				: 0
			: existing.featured;

	// Set published_at when first published
	let publishedAt = existing.published_at;
	if (status === "published" && !publishedAt) {
		publishedAt = now;
	}

	await db
		.prepare(
			`UPDATE posts
       SET title = ?, slug = ?, description = ?, content = ?, rendered_html = ?,
           tags = ?, status = ?, featured = ?, updated_at = ?, published_at = ?
       WHERE id = ?`
		)
		.bind(
			title,
			slug,
			description,
			content,
			rendered_html,
			tags,
			status,
			featured,
			now,
			publishedAt,
			id
		)
		.run();

	return await getPostById(db, id);
}

export async function deletePost(
	db: D1Database,
	id: string
): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM posts WHERE id = ?")
		.bind(id)
		.run();
	return result.meta.changes > 0;
}
