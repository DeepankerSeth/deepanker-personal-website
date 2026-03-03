import rss from "@astrojs/rss";
import { getAllPublishedPosts } from "../lib/db";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export async function GET(context) {
	const db = context.locals.runtime.env.DB;
	const posts = await getAllPublishedPosts(db);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.title,
			description: post.description,
			pubDate: new Date(post.published_at || post.created_at),
			link: `/writing/${post.slug}/`,
		})),
	});
}
