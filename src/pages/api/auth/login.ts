import type { APIRoute } from "astro";
import { verifyPassword, createToken, createAuthCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { password } = body;

		if (!password) {
			return new Response(JSON.stringify({ error: "Password is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const storedHash = locals.runtime.env.ADMIN_PASSWORD_HASH;
		const jwtSecret = locals.runtime.env.JWT_SECRET;

		if (!storedHash || !jwtSecret) {
			return new Response(JSON.stringify({ error: "Server not configured" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		const valid = await verifyPassword(password, storedHash);
		if (!valid) {
			return new Response(JSON.stringify({ error: "Invalid password" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const token = await createToken(jwtSecret);
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Set-Cookie": createAuthCookie(token),
			},
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
