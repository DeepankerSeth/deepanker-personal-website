import { env } from "cloudflare:workers";
import { unpublishPost } from '../../../../../lib/editor/database';
import { editorBody, editorEndpoint, editorJson } from '../../../../../lib/editor/http';

export const POST = editorEndpoint(async ({ params, request }) =>
	editorJson(await unpublishPost(env.DB, params.id!, await editorBody(request))));
