import type { APIRoute } from "astro";
import { getAllPosts, createPost } from "../../../lib/db";
import { renderMarkdown, generateSlug } from "../../../lib/markdown";

export const GET: APIRoute = async ({ locals }) => {
	const db = locals.runtime.env.DB;
	const posts = await getAllPosts(db);
	return new Response(JSON.stringify(posts), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const db = locals.runtime.env.DB;
		const body = await request.json() as any;

		const { title, description, content, tags, status, featured } = body;

		if (!title || !content) {
			return new Response(
				JSON.stringify({ error: "Title and content are required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		const slug = body.slug || generateSlug(title);
		const rendered_html = renderMarkdown(content);
		const tagList = Array.isArray(tags)
			? tags
			: typeof tags === "string"
				? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
				: [];

		const post = await createPost(db, {
			title,
			slug,
			description: description || "",
			content,
			rendered_html,
			tags: tagList,
			status: status || "draft",
			featured: featured || false,
		});

		return new Response(JSON.stringify(post), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err: any) {
		const message = err?.message?.includes("UNIQUE")
			? "A post with this slug already exists"
			: "Failed to create post";
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
};
