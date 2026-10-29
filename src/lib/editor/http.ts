import type { APIRoute, APIContext } from 'astro';
import { EditorError } from './validation';

export function editorJson(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
	});
}

export async function editorBody(request: Request): Promise<unknown> {
	if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
		throw new EditorError(415, 'unsupported_media_type', 'Send editor requests as JSON.');
	}
	const maxBytes = 5_000_000;
	const reader = request.body?.getReader();
	if (!reader) throw new EditorError(400, 'invalid_json', 'The request body is empty.');
	const decoder = new TextDecoder();
	let size = 0;
	let text = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) {
				await reader.cancel();
				throw new EditorError(413, 'too_large', 'This document is too large to save.');
			}
			text += decoder.decode(value, { stream: true });
		}
		text += decoder.decode();
	} finally { reader.releaseLock(); }
	try { return JSON.parse(text); }
	catch { throw new EditorError(400, 'invalid_json', 'The request did not contain valid JSON.'); }
}

export function editorEndpoint(handler: (context: APIContext) => Promise<Response>): APIRoute {
	return async (context) => {
		try { return await handler(context); }
		catch (error) {
			if (error instanceof EditorError) {
				return editorJson({ error: error.message, code: error.code, ...(error.fields ? { fields: error.fields } : {}) }, error.status);
			}
			// Constraint errors must be useful without returning SQL or essay text.
			if (error instanceof Error && /UNIQUE constraint failed: posts\.slug/i.test(error.message)) {
				return editorJson({ error: 'Another essay already uses this URL.', code: 'slug_conflict', fields: { slug: 'Choose a different URL slug.' } }, 409);
			}
			return editorJson({ error: 'The editor could not complete this request. Your text is still available in the editor.', code: 'editor_unavailable' }, 500);
		}
	};
}
