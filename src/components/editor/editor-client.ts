import { emptyDocument, type EditablePost, type EditorDocument, type EditorErrorBody } from '../../lib/editor/contracts';

const root = document.querySelector<HTMLElement>('[data-post-editor]');
if (root) initializeEditor(root);

function initializeEditor(root: HTMLElement) {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const initialText = element<HTMLScriptElement>('editor-initial').textContent ?? 'null';
  let current = JSON.parse(initialText) as EditorDocument | null;
  let rawContent = current?.document.content ?? '';
  let savedDocument = JSON.stringify(current?.document ?? emptyDocument());
  let busy = false;
  let allowLeave = false;
  let previewLoaded = false;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let mode = 'write';
  let recovery: EditablePost | undefined;
  let recoverySourceKey: string | undefined;
  type PendingCreation = { id: string; document: EditablePost; uncertain: boolean };
  let pendingCreation: PendingCreation | undefined;
  let localRecoveryUnavailable = false;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const previousState = history.state && typeof history.state === 'object' ? history.state : {};
  // Scope recovery to this history entry: a fresh New piece must never reuse another creation.
  const creationEntry = typeof previousState.writingRoomCreation === 'string' && uuidPattern.test(previousState.writingRoomCreation)
    ? previousState.writingRoomCreation as string : current ? undefined : crypto.randomUUID();
  if (!current && creationEntry) history.replaceState({ ...previousState, writingRoomCreation: creationEntry }, '');
  const pendingCreationKey = creationEntry ? `writing-room:pending-creation:${creationEntry}` : undefined;
  const newRecoveryKey = creationEntry ? `writing-room:recovery:new:${creationEntry}` : 'writing-room:recovery:new';
  const narrowEditor = matchMedia('(max-width: 800px)');
  const form = element<HTMLFormElement>('post-form');
  const fields = element<HTMLFieldSetElement>('editor-fields');
  const title = element<HTMLInputElement>('post-title');
  const slug = element<HTMLInputElement>('post-slug');
  const tags = element<HTMLInputElement>('post-tags');
  const description = element<HTMLTextAreaElement>('post-description');
  const excerpt = element<HTMLTextAreaElement>('post-excerpt');
  const content = element<HTMLTextAreaElement>('post-content');
  const featured = element<HTMLInputElement>('post-featured');
  const saveButton = element<HTMLButtonElement>('save-draft');
  const publishButton = element<HTMLButtonElement>('publish-post');
  const unpublishButton = element<HTMLButtonElement>('unpublish-post');
  const frame = element<HTMLIFrameElement>('editor-preview');
  const fileInput = element<HTMLInputElement>('markdown-file');
  const saveState = element<HTMLElement>('save-state');
  const message = element<HTMLElement>('editor-message');
  const actionError = element<HTMLAnchorElement>('action-error');
  const restoreRecovery = element<HTMLButtonElement>('restore-recovery');
  const dismissRecovery = element<HTMLButtonElement>('dismiss-recovery');
  const recoveryKey = () => current ? `writing-room:recovery:${current.id}` : newRecoveryKey;

  function isEditableDocument(value: unknown): value is EditablePost {
    if (!value || typeof value !== 'object') return false;
    const document = value as Partial<EditablePost>;
    return ['title', 'slug', 'description', 'content'].every((key) => typeof document[key as keyof EditablePost] === 'string')
      && (document.reading_excerpt === null || typeof document.reading_excerpt === 'string')
      && Array.isArray(document.tags) && document.tags.every((tag) => typeof tag === 'string')
      && typeof document.featured === 'boolean'
      && (document.cover_variant === null || typeof document.cover_variant === 'string')
      && (document.cover_accent === null || typeof document.cover_accent === 'string');
  }
  function writeRecovery(key: string, document: EditablePost): boolean {
    try { sessionStorage.setItem(key, JSON.stringify({ document, updatedAt: Date.now() })); return true; }
    catch { localRecoveryUnavailable = true; return false; }
  }
  function persistPendingCreation() {
    if (!pendingCreation || !pendingCreationKey) return;
    try { sessionStorage.setItem(pendingCreationKey, JSON.stringify(pendingCreation)); }
    catch { localRecoveryUnavailable = true; /* In-memory retries still use the immutable request. */ }
  }
  function removeCreationRecovery() {
    if (!creationEntry) return;
    try {
      if (pendingCreationKey) sessionStorage.removeItem(pendingCreationKey);
      sessionStorage.removeItem(newRecoveryKey);
      if (recoverySourceKey) sessionStorage.removeItem(recoverySourceKey);
    } catch { /* Optional local recovery. */ }
  }

  function documentValue(): EditablePost {
    return {
      title: title.value, slug: slug.value, description: description.value,
      reading_excerpt: excerpt.value || null, content: rawContent,
      tags: tags.value.split(',').map((tag) => tag.trim()).filter(Boolean), featured: featured.checked,
      cover_variant: current?.document.cover_variant ?? null,
      cover_accent: current?.document.cover_accent ?? null,
    };
  }
  function isDirty() {
    // Even an intentionally emptied editor must survive an unresolved first save.
    return !!pendingCreation || JSON.stringify(documentValue()) !== savedDocument;
  }
  function setDocument(document: EditablePost) {
    title.value = document.title; slug.value = document.slug; description.value = document.description;
    tags.value = document.tags.join(', '); excerpt.value = document.reading_excerpt ?? '';
    featured.checked = document.featured; rawContent = document.content; content.value = rawContent;
    updateState();
  }
  function persistRecovery() {
    try {
      if (isDirty()) sessionStorage.setItem(recoveryKey(), JSON.stringify({ document: documentValue(), updatedAt: Date.now() }));
      else if (!recovery) sessionStorage.removeItem(recoveryKey());
    } catch { localRecoveryUnavailable = true; /* In-memory editing and download remain usable. */ }
  }
  function updateState() {
    const dirty = isDirty();
    root.dataset.dirty = String(dirty);
    const words = rawContent.trim() ? rawContent.trim().split(/\s+/u).length : 0;
    element('word-count').textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
    if (!busy) saveState.textContent = dirty ? 'Unsaved changes' : current ? `Saved ${new Date(current.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not saved yet';
    const live = current?.publicationStatus === 'published';
    element('publication-state').textContent = live ? (current?.hasUnpublishedChanges || dirty ? 'Published · private edits' : 'Published') : 'Private draft';
    element('publication-state').classList.toggle('is-live', live);
    element('visibility-note').textContent = live ? 'Draft edits stay private until you publish changes.' : 'Only you can see this draft.';
    publishButton.textContent = live ? 'Publish changes ↗' : 'Publish now ↗';
    unpublishButton.hidden = !live;
    slug.readOnly = !!current?.publishedAt || live;
    element('slug-note').textContent = slug.readOnly ? 'This published address stays permanent.' : 'Leave blank to use the title.';
    element('public-link-wrap').hidden = !live;
    element<HTMLAnchorElement>('public-link').href = `/writing/${current?.document.slug ?? slug.value}`;
    if (current) element<HTMLAnchorElement>('open-latest').href = `/admin/posts/${current.id}/edit`;
    element('restore-published').hidden = !(current?.hasConflict && current.publishedRevision > 0);
  }
  function clearFieldError(field: HTMLElement) {
    field.removeAttribute('aria-invalid');
    const descriptions = (field.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id && id !== `${field.id}-error`);
    if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
    else field.removeAttribute('aria-describedby');
  }
  function clearErrors() {
    actionError.hidden = true;
    element('field-errors').replaceChildren();
    element('field-errors').hidden = true;
    form.querySelectorAll<HTMLElement>('[aria-invalid]').forEach(clearFieldError);
  }
  function showMessage(text: string, kind: 'success' | 'error' | 'notice' = 'notice') {
    message.hidden = false; message.dataset.kind = kind;
    actionError.hidden = kind !== 'error';
    element('editor-message-text').textContent = text + (localRecoveryUnavailable && isDirty() ? ' Local recovery is unavailable in this browser. Keep this tab open or download your Markdown before reloading.' : '');
    element('session-actions').hidden = true; element('conflict-actions').hidden = true;
  }
  class RequestError extends Error {
    constructor(public status: number, public detail: EditorErrorBody) { super(detail.error); }
  }
  async function request<T>(url: string, method: string, body?: unknown, expectedStatus?: number): Promise<T> {
    const response = await fetch(url, {
      method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && typeof data === 'object' && 'error' in data ? data as EditorErrorBody : { error: 'The request could not be completed. Your writing is still here.', code: 'request_failed' };
      throw new RequestError(response.status, detail);
    }
    if (expectedStatus !== undefined && response.status !== expectedStatus) throw new Error('The save response could not be confirmed.');
    return data as T;
  }
  function handleError(error: unknown) {
    persistRecovery();
    if (!(error instanceof RequestError)) {
      showMessage('The connection failed. Your writing is still here. Try saving again, or download your Markdown.', 'error');
      return;
    }
    if (error.status === 401) {
      showMessage('Your session has expired. Your writing is still here. Sign in in another tab, then return to save.', 'error');
      element('session-actions').hidden = false;
    } else if (pendingCreation && (error.detail.code === 'creation_conflict' || (pendingCreation.uncertain && [400, 413, 415, 422].includes(error.status)))) {
      showMessage(`${error.message} The first save has not been reconciled. Your current text and original save request are kept. Open the saved version to compare, or download your Markdown.`, 'error');
      element<HTMLAnchorElement>('open-latest').href = `/admin/posts/${pendingCreation.id}/edit`;
      element('conflict-actions').hidden = false;
    } else if (error.status === 409 && error.detail.code === 'version_conflict') {
      showMessage(`${error.message} Your current text remains in this editor. Download it before replacing or comparing versions.`, 'error');
      element('conflict-actions').hidden = false;
    } else {
      showMessage(error.message, 'error');
    }
    const fieldIds: Record<string, string> = { title: 'post-title', slug: 'post-slug', description: 'post-description', reading_excerpt: 'post-excerpt', content: 'post-content', tags: 'post-tags', featured: 'post-featured' };
    const list = element('field-errors');
    for (const [name, explanation] of Object.entries(error.detail.fields ?? {})) {
      const field = document.getElementById(fieldIds[name]);
      field?.setAttribute('aria-invalid', 'true');
      const item = document.createElement('li');
      if (field) {
        item.id = `${field.id}-error`;
        const descriptions = new Set((field.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
        descriptions.add(item.id);
        field.setAttribute('aria-describedby', [...descriptions].join(' '));
        const link = document.createElement('a'); link.href = `#${field.id}`; link.textContent = `${name.replaceAll('_', ' ')}: ${explanation}`;
        link.addEventListener('click', (event) => { event.preventDefault(); element<HTMLDetailsElement>('editor-details').open = true; switchMode('write'); field.focus(); });
        item.appendChild(link);
      } else item.textContent = explanation;
      list.appendChild(item);
    }
    list.hidden = !list.childElementCount;
  }
  function setBusy(value: boolean, label = '') {
    busy = value; fields.disabled = value; saveButton.disabled = value; publishButton.disabled = value; unpublishButton.disabled = value;
    restoreRecovery.disabled = value; dismissRecovery.disabled = value;
    root.setAttribute('aria-busy', String(value));
    if (value) saveState.textContent = label;
    else updateState();
  }
  function acceptSaved(next: EditorDocument) {
    const oldKey = recoveryKey();
    current = next; savedDocument = JSON.stringify(next.document);
    recovery = undefined;
    setDocument(next.document);
    try { sessionStorage.removeItem(oldKey); sessionStorage.removeItem(recoveryKey()); } catch { /* Optional local recovery. */ }
    element('recovery-notice').hidden = true;
    history.replaceState(null, '', `/admin/posts/${next.id}/edit`);
    document.title = `${next.document.title || 'Untitled piece'} — Writing room · Deepanker Seth`;
    updateState();
  }
  async function saveSnapshot(): Promise<EditorDocument> {
    if (!current) {
      if (!pendingCreation) {
        // Never replace this document with live fields while the outcome is uncertain.
        pendingCreation = { id: creationEntry!, document: documentValue(), uncertain: false };
      }
      persistRecovery();
      const attempt = pendingCreation;
      const previouslyUncertain = attempt.uncertain;
      // Persist uncertainty before dispatch, so a reload during the request is also safe.
      attempt.uncertain = true;
      persistPendingCreation();
      let created: EditorDocument;
      try {
        created = await request<EditorDocument>('/api/editor/posts', 'POST', { id: attempt.id, document: attempt.document }, 201);
        if (!created || created.id !== attempt.id || !isEditableDocument(created.document)
          || created.draftVersion !== 1 || created.publishedRevision !== 0 || created.baseRevision !== 0
          || created.publicationStatus !== 'unpublished' || typeof created.savedAt !== 'string') {
          throw new Error('The first save response could not be confirmed.');
        }
      } catch (error) {
        if (error instanceof RequestError && [401, 403].includes(error.status)) {
          // Auth/origin rejection happens before a write; keep the request without inventing uncertainty.
          attempt.uncertain = previouslyUncertain;
          persistPendingCreation();
        } else if (error instanceof RequestError && [400, 413, 415, 422].includes(error.status) && !previouslyUncertain) {
          // These responses guarantee no first write. Corrections may start a new request.
          pendingCreation = undefined;
          try { if (pendingCreationKey) sessionStorage.removeItem(pendingCreationKey); } catch { /* Optional storage. */ }
        }
        throw error;
      }
      const liveDocument = documentValue();
      const changedSinceRequest = JSON.stringify(liveDocument) !== JSON.stringify(attempt.document);
      // Move unsaved text before dropping the request record or changing the URL.
      const movedRecovery = writeRecovery(`writing-room:recovery:${created.id}`, liveDocument);
      current = created;
      savedDocument = JSON.stringify(created.document);
      pendingCreation = undefined;
      recovery = undefined;
      element('recovery-notice').hidden = true;
      history.replaceState(history.state, '', `/admin/posts/${created.id}/edit`);
      document.title = `${created.document.title || 'Untitled piece'} — Writing room · Deepanker Seth`;
      if (!changedSinceRequest) {
        acceptSaved(created);
        removeCreationRecovery();
        return created;
      }
      // Acknowledge the original request without overwriting edits made before its retry.
      updateState();
      if (movedRecovery) removeCreationRecovery();
      persistRecovery();
    }
    const next = await request<EditorDocument>(`/api/editor/posts/${current.id}`, 'PUT', {
      document: documentValue(), expectedDraftVersion: current.draftVersion, expectedPublishedRevision: current.publishedRevision,
    });
    acceptSaved(next);
    removeCreationRecovery();
    return next;
  }
  async function save() {
    if (busy) return;
    clearErrors(); setBusy(true, 'Saving privately…');
    try { await saveSnapshot(); showMessage('Private draft saved.', 'success'); }
    catch (error) { handleError(error); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (busy) return;
    clearErrors(); setBusy(true, 'Publishing this version…');
    try {
      // This call is only reached through the explicit Publish button. Preview never saves.
      const snapshot = await saveSnapshot();
      const published = await request<EditorDocument>(`/api/editor/posts/${snapshot.id}/publish`, 'POST', { expectedDraftVersion: snapshot.draftVersion, expectedPublishedRevision: snapshot.publishedRevision });
      acceptSaved(published);
      showMessage('Published. This version is now available on your website.', 'success');
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  }
  async function unpublish() {
    if (busy || !current) return;
    if (!confirm('Unpublish this piece? It will leave the public website. Your draft and the text in this editor will be kept.')) return;
    clearErrors(); setBusy(true, 'Unpublishing…');
    try {
      // Unpublishing does not save or discard the current, possibly unsaved, text.
      current = await request<EditorDocument>(`/api/editor/posts/${current.id}/unpublish`, 'POST', { expectedDraftVersion: current.draftVersion, expectedPublishedRevision: current.publishedRevision });
      savedDocument = JSON.stringify(current.document);
      updateState(); persistRecovery();
      showMessage('This piece is now private. Your current editor text has been kept.', 'success');
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  }
  function exportMarkdown() {
    const file = new Blob([rawContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a'); link.href = url; link.download = `${slug.value || 'untitled'}.md`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function sendPreview() {
    if (mode === 'write' || !previewLoaded) return;
    frame.contentWindow?.postMessage({ type: 'editor:preview', document: documentValue() }, location.origin);
  }
  function schedulePreview() {
    clearTimeout(previewTimer);
    if (mode !== 'write') previewTimer = setTimeout(sendPreview, 450);
  }
  function switchMode(next: string) {
    if (next === 'split' && narrowEditor.matches) next = 'write';
    mode = next;
    const workbench = root.querySelector<HTMLElement>('.editor-workbench')!;
    workbench.dataset.mode = next;
    element('write-panel').hidden = next === 'preview';
    element('preview-panel').hidden = next === 'write';
    root.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach((tab) => { const selected = tab.dataset.editorMode === next; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    if (next !== 'write') {
      if (!frame.getAttribute('src')) frame.src = frame.dataset.previewSrc!;
      else sendPreview();
    }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); void save(); });
  publishButton.addEventListener('click', () => void publish());
  unpublishButton.addEventListener('click', () => void unpublish());
  content.addEventListener('input', () => { rawContent = content.value; });
  fields.addEventListener('input', (event) => {
    clearFieldError(event.target as HTMLElement);
    if (message.dataset.kind === 'success') message.hidden = true;
    updateState(); persistRecovery(); schedulePreview();
  });
  element('export-markdown').addEventListener('click', exportMarkdown);
  element('conflict-export').addEventListener('click', exportMarkdown);
  element('restore-published').addEventListener('click', async () => {
    if (busy || !current?.hasConflict || !current.publishedRevision) return;
    if (!confirm('Restore the published version? This discards the private draft and replaces the editor text. A Markdown copy of your current text will download first.')) return;
    exportMarkdown();
    clearErrors(); setBusy(true, 'Restoring the published version…');
    try {
      const restored = await request<EditorDocument>(`/api/editor/posts/${current.id}/discard`, 'POST', { expectedDraftVersion: current.draftVersion, expectedPublishedRevision: current.publishedRevision });
      acceptSaved(restored);
      showMessage('The published version is ready to edit. Your previous text was downloaded as Markdown.', 'success');
      schedulePreview();
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  });
  element('import-markdown').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    if (busy) { fileInput.value = ''; return; }
    let importing = false;
    let importedSuccessfully = false;
    try {
      if (file.size > 4_000_000) { showMessage('Choose a Markdown file smaller than 4 MB.', 'error'); return; }
      if (rawContent && !confirm('Replace the editor text with this Markdown file? Other essay details will stay.')) return;
      importing = true; setBusy(true, 'Importing Markdown…');
      // ignoreBOM preserves a UTF-8 BOM as text. Untouched imports keep all original line endings.
      const imported = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      if (imported.length > 1_000_000 || imported.includes('\0')) { showMessage('This file is too large or is not a plain-text Markdown document.', 'error'); return; }
      rawContent = imported; content.value = imported;
      updateState(); persistRecovery(); schedulePreview();
      showMessage(`Imported ${file.name}. Save a private draft when you’re ready.`, 'notice');
      switchMode('write'); importedSuccessfully = true;
    } catch { showMessage('This file could not be read as UTF-8 Markdown. Your existing writing has been kept.', 'error'); }
    finally {
      fileInput.value = '';
      if (importing) setBusy(false);
      if (importedSuccessfully) content.focus();
    }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.editorMode!));
    tab.addEventListener('keydown', (event) => {
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-editor-mode]')).filter((item) => item.offsetParent !== null);
      const index = tabs.indexOf(tab);
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); tabs[next].focus(); switchMode(tabs[next].dataset.editorMode!);
    });
  });
  narrowEditor.addEventListener('change', () => {
    if (narrowEditor.matches && mode === 'split') {
      const hadTabFocus = document.activeElement === element('split-tab');
      switchMode('write');
      if (hadTabFocus) element('write-tab').focus();
    }
  });
  actionError.addEventListener('click', (event) => {
    event.preventDefault();
    message.focus({ preventScroll: true });
    message.scrollIntoView({ block: 'center', behavior: 'auto' });
  });
  frame.addEventListener('load', () => {
    try {
      if (frame.contentWindow?.location.pathname === '/admin/login') {
        previewLoaded = false; frame.hidden = true;
        showMessage('Your session has expired. Sign in in another tab, then refresh this preview. Your writing is still here.', 'error');
        element('session-actions').hidden = false;
        return;
      }
    } catch { previewLoaded = false; return; }
    previewLoaded = true; frame.hidden = false; sendPreview();
  });
  element('refresh-preview').addEventListener('click', () => {
    if (!previewLoaded) { frame.hidden = false; frame.src = frame.dataset.previewSrc!; }
    else sendPreview();
  });
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'editor:save') void save();
    if (event.data.type === 'editor:preview:ready' && !previewLoaded) { previewLoaded = true; sendPreview(); }
    if (event.data.type === 'editor:preview:error') {
      if (event.data.status === 401) {
        showMessage('Your session has expired. Sign in in another tab, then refresh this preview. Your writing is still here.', 'error');
        element('session-actions').hidden = false;
      } else showMessage(typeof event.data.error === 'string' ? event.data.error : 'Preview could not be loaded. Your writing is still here.', 'error');
    }
  });
  document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); } });
  window.addEventListener('beforeunload', (event) => { if (isDirty() && !allowLeave) { persistRecovery(); event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', persistRecovery);
  window.addEventListener('editor:leaving', () => { allowLeave = true; persistRecovery(); });
  updateState();
  try {
    const storedPending = pendingCreationKey ? sessionStorage.getItem(pendingCreationKey) : null;
    if (storedPending) {
      const parsed = JSON.parse(storedPending) as Partial<PendingCreation>;
      if (typeof parsed.id === 'string' && uuidPattern.test(parsed.id) && isEditableDocument(parsed.document)
        && typeof parsed.uncertain === 'boolean' && (!current || parsed.id === current.id)) {
        pendingCreation = parsed as PendingCreation;
      }
    }
  } catch { /* A broken optional request record must not prevent access to local writing. */ }
  try {
    // The unscoped key is only a compatibility fallback for older editor recovery records.
    const keys = current
      ? [recoveryKey(), ...(pendingCreation ? [newRecoveryKey] : [])]
      : [recoveryKey(), ...(pendingCreation ? [] : ['writing-room:recovery:new'])];
    for (const key of keys) {
      const stored = sessionStorage.getItem(key);
      if (!stored) continue;
      const parsed = JSON.parse(stored) as { document?: EditablePost };
      if (isEditableDocument(parsed.document) && ((!current && !!pendingCreation) || JSON.stringify(parsed.document) !== savedDocument)) {
        recovery = parsed.document; recoverySourceKey = key; break;
      }
    }
  } catch { /* A broken optional recovery snapshot must not prevent editing. */ }
  if (!current && pendingCreation) {
    // This history entry identifies the same piece, so reload restores its latest local text.
    setDocument(recovery ?? pendingCreation.document);
    recovery = undefined;
    persistRecovery();
    showMessage('Your unconfirmed first save and local writing have been restored. Save again to safely retry that request and then save your latest edits.', 'notice');
  } else if (current && pendingCreation) {
    // A confirmed creation may leave this fallback if moving recovery was blocked by storage.
    pendingCreation = undefined;
  }
  if (recovery) element('recovery-notice').hidden = false;
  restoreRecovery.addEventListener('click', () => {
    if (busy || !recovery) return;
    if (isDirty() && JSON.stringify(documentValue()) !== JSON.stringify(recovery)
      && !confirm('Restore the recovered writing? This will replace the unsaved text currently in this editor. Cancel to keep editing or download your Markdown first.')) return;
    const restored = recovery; recovery = undefined;
    setDocument(restored); element('recovery-notice').hidden = true; persistRecovery(); schedulePreview();
    showMessage('Your unsaved writing has been restored in this editor.', 'notice');
  });
  dismissRecovery.addEventListener('click', () => { if (busy) return; recovery = undefined; element('recovery-notice').hidden = true; try { sessionStorage.removeItem(recoveryKey()); if (recoverySourceKey) sessionStorage.removeItem(recoverySourceKey); } catch { /* Optional storage. */ } });
  if (current?.hasConflict) {
    showMessage('The published version has changed since this private draft began. Your draft is preserved; compare the versions before publishing.', 'error');
    element('conflict-actions').hidden = false;
  }
}
