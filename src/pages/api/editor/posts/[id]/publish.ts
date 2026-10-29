import { env } from "cloudflare:workers";
import { publishDraft } from '../../../../../lib/editor/database';
import { editorBody, editorEndpoint, editorJson } from '../../../../../lib/editor/http';

export const POST = editorEndpoint(async ({ params, request }) =>
	editorJson(await publishDraft(env.DB, params.id!, await editorBody(request))));
