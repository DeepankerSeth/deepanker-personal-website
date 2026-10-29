import { env } from "cloudflare:workers";
// Astro middleware — protects admin pages and editorial APIs.

import { defineMiddleware } from "astro:middleware";
import { verifyToken, getTokenFromCookie } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Keep local HTTP development usable, but never authenticate or replay a
	// write over the public site's insecure origin. Canonical metadata alone
	// does not move a reader (or the login form) onto HTTPS.
	if (context.url.hostname === 'deepankerseth.com' && context.url.protocol === 'http:') {
		if (['GET', 'HEAD'].includes(context.request.method)) {
			const secureUrl = new URL(context.url);
			secureUrl.protocol = 'https:';
			return new Response(null, { status: 308, headers: { Location: secureUrl.href } });
		}
		return new Response(JSON.stringify({ error: 'HTTPS is required for this request.', code: 'insecure_transport' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
		});
	}

	// Images are served directly from static files or their authored URLs.
	// The unused Astro optimizer is not part of this site's public surface.
	if (pathname === '/_image' || pathname === '/_image/') {
		return new Response('Not found', {
			status: 404,
			headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
		});
	}

	// Public routes — no auth needed
	if (pathname === "/admin/login") return next();
	const isAuthApi = pathname.startsWith('/api/auth/');
	const isEditorApi = pathname === '/api/editor' || pathname.startsWith('/api/editor/');
	const isPostsApi = pathname.startsWith('/api/posts');
	if ((isAuthApi || isEditorApi || isPostsApi) && !['GET', 'HEAD'].includes(context.request.method)) {
		const origin = context.request.headers.get('origin');
		if (origin && origin !== context.url.origin) {
			return new Response(JSON.stringify({ error: 'This editor request came from a different origin.', code: 'invalid_origin' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
			});
		}
	}
	if (isAuthApi) return next();

	// Protected routes
	const isAdminPage = pathname.startsWith("/admin");
	const isProtectedApi = isPostsApi || isEditorApi;

	if (!isAdminPage && !isProtectedApi) return next();

	// Check auth
	const cookieHeader = context.request.headers.get("cookie");
	const token = getTokenFromCookie(cookieHeader);
	const secret = env.JWT_SECRET;

	if (!token || !secret || !(await verifyToken(token, secret))) {
		if (isAdminPage) {
			const response = context.redirect("/admin/login");
			response.headers.set('Cache-Control', 'private, no-store');
			return response;
		}
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
		});
	}

	const response = await next();
	if (isProtectedApi || isAdminPage) response.headers.set('Cache-Control', 'private, no-store');
	return response;
});
