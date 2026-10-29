import { env } from "cloudflare:workers";
import rss from "@astrojs/rss";
import { getAllPublishedPosts } from "../lib/db";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";
import { publicUrl } from "../shared/public/routes";

export async function GET(context) {
	const db = env.DB;
	const posts = await getAllPublishedPosts(db);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		// Existing feed GUIDs include this slash; keep subscriber identity stable.
		trailingSlash: true,
		items: posts.map((post) => ({
			title: post.title,
			description: post.description,
			pubDate: new Date(post.published_at || post.created_at),
			link: publicUrl('post', post.slug),
		})),
	});
}
