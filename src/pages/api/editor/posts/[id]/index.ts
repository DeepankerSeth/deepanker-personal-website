import { env } from "cloudflare:workers";
import { getEditorDocument, saveDraft } from '../../../../../lib/editor/database';
import { editorBody, editorEndpoint, editorJson } from '../../../../../lib/editor/http';

export const GET = editorEndpoint(async ({ params }) =>
	editorJson(await getEditorDocument(env.DB, params.id!)));

export const PUT = editorEndpoint(async ({ params, request }) =>
	editorJson(await saveDraft(env.DB, params.id!, await editorBody(request))));
