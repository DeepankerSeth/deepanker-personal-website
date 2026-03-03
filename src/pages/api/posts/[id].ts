import type { APIRoute } from "astro";
import { getPostById, updatePost, deletePost } from "../../../lib/db";
import { renderMarkdown } from "../../../lib/markdown";

export const GET: APIRoute = async ({ params, locals }) => {
	const db = locals.runtime.env.DB;
	const post = await getPostById(db, params.id!);

	if (!post) {
		return new Response(JSON.stringify({ error: "Post not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify(post), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
	try {
		const db = locals.runtime.env.DB;
		const body = await request.json();

		const updateData: any = {};
		if (body.title !== undefined) updateData.title = body.title;
		if (body.slug !== undefined) updateData.slug = body.slug;
		if (body.description !== undefined) updateData.description = body.description;
		if (body.status !== undefined) updateData.status = body.status;
		if (body.featured !== undefined) updateData.featured = body.featured;
		if (body.tags !== undefined) {
			updateData.tags = Array.isArray(body.tags)
				? body.tags
				: typeof body.tags === "string"
					? body.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
					: [];
		}
		if (body.content !== undefined) {
			updateData.content = body.content;
			updateData.rendered_html = renderMarkdown(body.content);
		}

		const post = await updatePost(db, params.id!, updateData);

		if (!post) {
			return new Response(JSON.stringify({ error: "Post not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify(post), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err: any) {
		const message = err?.message?.includes("UNIQUE")
			? "A post with this slug already exists"
			: "Failed to update post";
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
};

export const DELETE: APIRoute = async ({ params, locals }) => {
	const db = locals.runtime.env.DB;
	const deleted = await deletePost(db, params.id!);

	if (!deleted) {
		return new Response(JSON.stringify({ error: "Post not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
