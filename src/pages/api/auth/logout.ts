import type { APIRoute } from "astro";
import { clearAuthCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Set-Cookie": clearAuthCookie(new URL(request.url).protocol === 'https:'),
			"Cache-Control": "no-store",
		},
	});
};
