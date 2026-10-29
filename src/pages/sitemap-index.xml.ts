import type { APIRoute } from 'astro';

// Keep existing crawler registrations useful after replacing build-time discovery.
export const GET: APIRoute = ({ site }) => {
	if (!site) throw new Error('The canonical site URL is required for the sitemap.');
	const url = new URL('/sitemap.xml', site).href.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${url}</loc></sitemap></sitemapindex>\n`, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' },
	});
};
