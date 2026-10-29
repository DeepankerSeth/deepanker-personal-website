import { editorBody, editorEndpoint, editorJson } from '../../../lib/editor/http';
import { previewDocument } from '../../../lib/editor/markdown';
import { objectInput } from '../../../lib/editor/validation';

export const POST = editorEndpoint(async ({ request }) => {
	const body = objectInput(await editorBody(request));
	return editorJson(previewDocument(body.document));
});
