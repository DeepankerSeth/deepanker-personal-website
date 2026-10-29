import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { verifyPassword, createToken, createAuthCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json() as unknown;
		const password = body && typeof body === 'object' && 'password' in body ? body.password : undefined;

		if (typeof password !== 'string' || !password) {
			return new Response(JSON.stringify({ error: "Password is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
			});
		}

		const storedHash = env.ADMIN_PASSWORD_HASH;
		const jwtSecret = env.JWT_SECRET;

		if (!storedHash || !jwtSecret) {
			return new Response(JSON.stringify({ error: "Server not configured" }), {
				status: 500,
				headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
			});
		}

		const valid = await verifyPassword(password, storedHash);
		if (!valid) {
			return new Response(JSON.stringify({ error: "Invalid password" }), {
				status: 401,
				headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
			});
		}

		const token = await createToken(jwtSecret);
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Set-Cookie": createAuthCookie(token, new URL(request.url).protocol === 'https:'),
				"Cache-Control": "no-store",
			},
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		});
	}
};
