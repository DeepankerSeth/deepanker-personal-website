import { env } from "cloudflare:workers";
import { getEditorDocument } from '../../../../../lib/editor/database';
import { editorEndpoint } from '../../../../../lib/editor/http';
import { exportMarkdown } from '../../../../../lib/editor/validation';

export const GET = editorEndpoint(async ({ params }) => {
	const { document, id } = await getEditorDocument(env.DB, params.id!);
	const filename = document.slug.replace(/[^a-z0-9-]/g, '') || `essay-${id}`;
	return new Response(exportMarkdown(document), {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}.md"`,
			'Cache-Control': 'private, no-store',
		},
	});
});
