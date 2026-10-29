import { env } from "cloudflare:workers";
import { discardDraft } from '../../../../../lib/editor/database';
import { editorBody, editorEndpoint, editorJson } from '../../../../../lib/editor/http';

export const POST = editorEndpoint(async ({ params, request }) =>
	editorJson(await discardDraft(env.DB, params.id!, await editorBody(request))));
