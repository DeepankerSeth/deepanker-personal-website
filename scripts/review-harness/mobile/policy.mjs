// Test-fixture policy, deliberately independent of production configuration.
// Deterministic unit-test ID. Running editor profiles require their own fixture ID.
export const QA_ID = '7d79cb13-f1bf-4327-ba3d-1e9479d0fc5b';
export const isFixtureId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const profiles = ['touch', 'storage-denied', 'save-unavailable', 'save-expired', 'save-conflict', 'save-disconnect'];
export const editorProfile = profile => profile.startsWith('save-');
export const upstreamFor = profile => editorProfile(profile) ? 'http://127.0.0.1:4195' : 'http://127.0.0.1:4194';
export function cleanPath(value) {
  try {
    const path = decodeURIComponent(value);
    return path.startsWith('/') && !path.includes('\\') && !/[\u0000-\u001f\u007f]/.test(path) && !path.split('/').includes('..') ? path : null;
  } catch { return null; }
}
export function route(profile, method, path, qaId = QA_ID) {
  if (!profiles.includes(profile) || !path || (editorProfile(profile) && !isFixtureId(qaId))) return 'refuse';
  if (method === 'GET' || method === 'HEAD') {
    if (/^\/(?:literary|_astro)\/[A-Za-z0-9_./-]+$/.test(path) || ['/favicon.svg', '/', '/writing', '/rss.xml', '/robots.txt', '/sitemap.xml', '/sitemap-index.xml'].includes(path) || /^\/writing\/[a-z0-9-]+\/?$/.test(path)) return 'forward';
    if (editorProfile(profile) && ['/admin', '/admin/login', '/admin/preview', '/admin/posts/new', `/admin/posts/${qaId}/edit`, `/admin/posts/${qaId}/preview`, `/api/editor/posts/${qaId}`, `/api/editor/posts/${qaId}/export`].includes(path)) return 'forward';
  }
  if (editorProfile(profile)) {
    if ((method === 'PUT' && path === `/api/editor/posts/${qaId}`) || (method === 'POST' && path === '/api/editor/posts')) return 'save-fault';
    // These parse/preview or authenticate locally; they do not save a document.
    if (method === 'POST' && ['/api/auth/login', '/api/editor/import', '/api/editor/preview'].includes(path)) return 'forward';
  }
  return 'refuse';
}
export function saveFailure(profile) {
  if (profile === 'save-expired') return {status: 401, body: {error: 'Unauthorized'}};
  if (profile === 'save-conflict') return {status: 409, body: {error: 'This essay changed elsewhere. Keep your text and reload the latest version before saving.', code: 'version_conflict'}};
  if (profile === 'save-disconnect') return {disconnect: true};
  return {status: 503, body: {error: 'The editor could not complete this request. Your text is still available in the editor.', code: 'editor_unavailable'}};
}
export function requestHeaders(profile, incoming, origin) {
  const headers = {accept: '*/*', 'accept-encoding': 'identity', 'cache-control': 'no-cache'};
  if (editorProfile(profile)) {
    const cookie = String(incoming.cookie || '').split(';').map(s => s.trim()).find(s => /^admin_token=[A-Za-z0-9_.-]+$/.test(s));
    if (cookie) headers.cookie = cookie;
    if (incoming['content-type']) headers['content-type'] = incoming['content-type'];
    if (incoming.origin === origin) headers.origin = upstreamFor(profile);
  }
  return headers;
}
