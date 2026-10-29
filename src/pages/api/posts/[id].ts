import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getPostById } from '../../../lib/db';
import { editorJson } from '../../../lib/editor/http';
import { retiredPostMutation } from '../../../lib/editor/retired-post-api';

export const GET: APIRoute = async ({ params }) => {
  const post = await getPostById(env.DB, params.id!);
  return post ? editorJson(post) : editorJson({ error: 'Post not found' }, 404);
};

export const PUT = retiredPostMutation;
export const DELETE = retiredPostMutation;
