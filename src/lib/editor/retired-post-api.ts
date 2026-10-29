import type { APIRoute } from 'astro';
import { editorJson } from './http';

/** Old direct writers bypass working copies and immutable published URLs. */
export const retiredPostMutation: APIRoute = () => editorJson({
  error: 'Direct post changes are no longer supported. Use the writing room at /admin to save a private draft and explicitly publish it.',
  code: 'legacy_write_retired',
}, 410);
