// Database helper functions for Cloudflare D1
import type { CoverAccent, CoverVariant } from "../shared/public/covers";

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
	cover_variant: CoverVariant | null;
	cover_accent: CoverAccent | null;
	reading_excerpt?: string | null;
	created_at: string;
	updated_at: string;
	published_at: string | null;
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

// ── Protected read compatibility for /api/posts ──────────────────

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
