// Astro middleware — protects /admin and /api/posts routes

import { defineMiddleware } from "astro:middleware";
import { verifyToken, getTokenFromCookie } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Public routes — no auth needed
	if (pathname === "/admin/login") return next();
	if (pathname.startsWith("/api/auth/")) return next();

	// Protected routes
	const isAdminPage = pathname.startsWith("/admin");
	const isProtectedApi = pathname.startsWith("/api/posts");

	if (!isAdminPage && !isProtectedApi) return next();

	// Check auth
	const cookieHeader = context.request.headers.get("cookie");
	const token = getTokenFromCookie(cookieHeader);
	const secret = context.locals.runtime.env.JWT_SECRET;

	if (!token || !secret || !(await verifyToken(token, secret))) {
		if (isAdminPage) {
			return context.redirect("/admin/login");
		}
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	return next();
});
