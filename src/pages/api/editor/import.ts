import { emptyDocument } from '../../../lib/editor/contracts';
import { editorBody, editorEndpoint, editorJson } from '../../../lib/editor/http';
import { importMarkdown, objectInput, validateDocument } from '../../../lib/editor/validation';

export const POST = editorEndpoint(async ({ request }) => {
	const body = objectInput(await editorBody(request));
	const metadata = body.document === undefined ? emptyDocument() : validateDocument(body.document);
	// Validation handles wrong types; no trimming, newline, Unicode, or
	// frontmatter conversion is performed on the imported source.
	return editorJson({ document: importMarkdown(body.content as string, metadata) });
});
