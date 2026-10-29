import { env } from "cloudflare:workers";
import { createDraft, listEditorPosts } from '../../../../lib/editor/database';
import { editorBody, editorEndpoint, editorJson } from '../../../../lib/editor/http';

export const GET = editorEndpoint(async () =>
	editorJson({ posts: await listEditorPosts(env.DB) }));

export const POST = editorEndpoint(async ({ request }) =>
	editorJson(await createDraft(env.DB, await editorBody(request)), 201));
