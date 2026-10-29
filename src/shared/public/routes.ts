export type PublicRouteKind = 'home' | 'writing' | 'post';

/** Canonical public URLs. Legacy /classic routes redirect to these addresses. */
export function publicUrl(kind: PublicRouteKind, slug?: string): string {
  if (kind === 'home') return '/';
  if (kind === 'writing') return '/writing';
  if (!slug) throw new Error('publicUrl requires a slug for post routes');
  return `/writing/${encodeURIComponent(slug)}`;
}
