import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getAllPosts } from '../../../lib/db';
import { editorJson } from '../../../lib/editor/http';
import { retiredPostMutation } from '../../../lib/editor/retired-post-api';

// Read compatibility is authenticated by middleware. All writing now goes
// through the private-draft workflow, including explicit guarded publication.
export const GET: APIRoute = async () => editorJson(await getAllPosts(env.DB));
export const POST = retiredPostMutation;
