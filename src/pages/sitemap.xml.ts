import { env } from "cloudflare:workers";
import type { APIRoute } from 'astro';
import { getAllPublishedPosts } from '../lib/db';
import { publicUrl } from '../shared/public/routes';

const xmlEntities: Record<string, string> = {
	'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
};
const escapeXml = (value: string) => value.replace(/[<>&"']/g, character => xmlEntities[character]);

export const GET: APIRoute = async ({ site }) => {
	if (!site) throw new Error('The canonical site URL is required for the sitemap.');
	const posts = await getAllPublishedPosts(env.DB);
	const paths = [publicUrl('home'), publicUrl('writing'),
		...posts.map(post => publicUrl('post', post.slug))];
	const urls = [...new Set(paths.map(path => new URL(path, site).href))];
	const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
		urls.map(url => `<url><loc>${escapeXml(url)}</loc></url>`).join('') + '</urlset>\n';
	return new Response(xml, { headers: {
		'Content-Type': 'application/xml; charset=utf-8',
		'Cache-Control': 'public, max-age=0, must-revalidate',
	} });
};
