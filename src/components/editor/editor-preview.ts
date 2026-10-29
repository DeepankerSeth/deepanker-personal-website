import { isLongTitle, isPoetry } from '../../site/literary/typography';

// This frame renders unsaved writing through the publication renderer. It
// never saves a draft; keyboard Save is an explicit request to its parent.
let revision = 0;
let controller: AbortController | undefined;
const status = document.querySelector<HTMLElement>('[data-preview-status]')!;
const title = document.querySelector<HTMLElement>('[data-preview-title]')!;
const header = document.querySelector<HTMLElement>('.reading-header');
const kind = document.querySelector<HTMLElement>('[data-preview-kind]');
const minutes = document.querySelector<HTMLElement>('[data-preview-minutes]')!;
const prose = document.querySelector<HTMLElement>('[data-essay-prose]')!;

function send(type: string, error?: string, status?: number) {
  parent.postMessage({ type, error, status }, location.origin);
}

async function updatePreview(event: MessageEvent) {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'editor:preview') return;
  const documentData = event.data.document;
  if (!documentData || typeof documentData.content !== 'string') return;

  const current = ++revision;
  controller?.abort();
  controller = new AbortController();
  try {
    const response = await fetch('/api/editor/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: documentData }),
      signal: controller.signal,
    });
    const result = await response.json() as {
      error?: unknown;
      renderedHtml?: unknown;
      readingMinutes?: unknown;
    } | null;
    // Aborting fetch is not sufficient once a response has arrived. A late
    // success or error must never replace a newer document or its status.
    if (current !== revision) return;
    if (!response.ok) {
      if (response.status === 401) {
        status.textContent = 'Your session expired. Sign in again to preview.';
        send('editor:preview:error', 'Your session expired. Your writing is still in the editor.', 401);
        return;
      }
      throw new Error(typeof result?.error === 'string' ? result.error : 'Preview could not be loaded.');
    }
    if (typeof result?.renderedHtml !== 'string' || typeof result.readingMinutes !== 'number') {
      throw new Error('Preview returned an incomplete response. Your writing is still in the editor.');
    }

    const nextTitle = String(documentData.title || 'Untitled');
    title.textContent = nextTitle;
    title.classList.toggle('long-title', isLongTitle(nextTitle));
    header?.classList.toggle('long-title', isLongTitle(nextTitle));
    if (kind) kind.textContent = isPoetry(result.renderedHtml) ? 'Poem' : 'Essay';
    minutes.textContent = `${result.readingMinutes} min read`;
    prose.innerHTML = result.renderedHtml;
    status.textContent = 'Private preview · nothing here is saved or published';
    send('editor:preview:ready');
  } catch (error) {
    if (current !== revision || (error instanceof Error && error.name === 'AbortError')) return;
    const message = error instanceof Error ? error.message : 'Preview unavailable';
    status.textContent = message;
    send('editor:preview:error', message);
  }
}

addEventListener('message', updatePreview);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    send('editor:save');
  }
});
send('editor:preview:ready');
