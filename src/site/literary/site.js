import { formatVerseLines } from './typography';
(() => {
    'use strict';
    document.documentElement.classList.add('js');
    const $ = (s, r = document) => r?.querySelector(s), $$ = (s, r = document) => r ? [...r.querySelectorAll(s)] : [];
    let corpus = [];
    try {
        const data = JSON.parse($('#writing-data')?.textContent || '[]');
        if (Array.isArray(data))
            corpus = data;
    }
    catch { }
    const privatePreview = document.body.classList.contains('is-preview');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width:620px)');
    const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
    const hash = value => { let result = 2166136261; for (const char of normalize(value)) {
        result ^= char.charCodeAt(0);
        result = Math.imul(result, 16777619);
    } return (result >>> 0).toString(36); };
    const storage = { get(k) { try {
            return JSON.parse(localStorage.getItem(k) || 'null');
        }
        catch {
            return null;
        } }, set(k, v) { try {
            localStorage.setItem(k, JSON.stringify(v));
            return true;
        }
        catch {
            return false;
        } }, remove(k) { try {
            localStorage.removeItem(k);
            return true;
        }
        catch {
            return false;
        } } };
    const placeKey = 'ds:literary:v1:place', prefKey = 'ds:literary:v1:preferences', selectionKey = 'ds:literary:v1:selection';
    const validPlace = p => p && corpus.some(c => c.slug === p.slug && c.id === p.postId) && typeof p.text === 'string' && p.text.length > 0 && p.text.length <= 1000000 && p.hash === hash(p.text) && Number.isInteger(p.occurrence) && p.occurrence >= 0 && Number.isInteger(p.matches) && p.matches > p.occurrence && Number.isFinite(p.fraction) && p.fraction >= 0 && p.fraction <= 1;
    const readPlace = () => { if (privatePreview)
        return null; const p = storage.get(placeKey); return validPlace(p) ? p : null; };
    const rememberSelection = item => { if (privatePreview || !item)
        return; try {
        sessionStorage.setItem(selectionKey, item.slug);
    }
    catch { } };
    const fontsReady = () => document.fonts?.ready ?? Promise.resolve();
    const artLoads = new Map();
    const artStates = new WeakMap();
    const loadArtwork = url => {
        if (!artLoads.has(url))
            artLoads.set(url, new Promise(resolve => { const loader = new Image(); loader.onload = () => resolve(loader.naturalWidth > 0); loader.onerror = () => resolve(false); loader.src = url; }));
        return artLoads.get(url);
    };
    const requestArtwork = (svg, url, quality) => {
        const state = artStates.get(svg);
        if (!url || !state || state.requested.has(url))
            return;
        state.requested.add(url);
        state.pending++;
        // A separate Image observes cached failures too, even when the SVG's own
        // error event happened before this enhancement was ready.
        loadArtwork(url).then(ok => {
            state.pending--;
            if (!svg.isConnected)
                return;
            if (ok && quality > state.quality) {
                state.quality = quality;
                $$('image', svg).forEach(image => image.setAttribute('href', url));
                svg.dataset.artState = 'ready';
                if (state.title)
                    state.title.textContent = state.originalTitle;
                if (state.description)
                    state.description.textContent = state.originalDescription;
                if (state.detailButton) {
                    state.detailButton.hidden = false;
                    state.detailButton.disabled = false;
                }
            }
            else if (!state.quality && !state.pending) {
                svg.dataset.artState = 'failed';
                if (state.title)
                    state.title.textContent = 'Illustration unavailable';
                if (state.description)
                    state.description.textContent = 'Intended illustration: ' + state.originalDescription;
                if (state.detailButton) {
                    state.detailButton.hidden = true;
                    state.detailButton.disabled = true;
                }
            }
        });
    };
    $$('svg.material-print[data-material-base]').forEach(svg => {
        const title = $('title', svg), description = $('desc', svg);
        artStates.set(svg, { quality: 0, pending: 0, requested: new Set(), title, description, detailButton: $('[data-study-detail]', svg.closest('.detail-art')), originalTitle: title?.textContent || '', originalDescription: description?.textContent || '' });
        if (svg.closest('[aria-hidden="true"]'))
            svg.dataset.artDecorative = 'true';
        requestArtwork(svg, svg.dataset.materialBase, 320);
        if (svg.dataset.materialUpgrade === 'true')
            requestArtwork(svg, svg.dataset.materialSrc, 960);
    });
    const enhanceArtwork = (container, detail = false) => {
        $$('svg.material-print[data-material-base]', container).forEach(svg => {
            requestArtwork(svg, svg.dataset.materialSrc, 960);
            if (detail)
                requestArtwork(svg, svg.dataset.materialHires, 1536);
        });
    };
    $$('.enhanced').forEach(e => { if (!e.matches('[data-restore],[data-clear-place],.index-search'))
        e.hidden = false; });
    const index = $('.writing-index'), passageHost = $('.passage-panel'), panels = $$('[data-passage]');
    const artDialog = $('.art-dialog'), dialog = $('.contents');
    let artTrigger = null, artScroll = 0, artOverflow = '', artActive = false, dialogTrigger = null, dialogScroll = 0, dialogOverflow = '', dialogActive = false;
    let selected = Number($('.writing-index [data-entry].chosen')?.dataset.entry ?? $('.writing-index [data-entry]:not([hidden])')?.dataset.entry ?? -1), expanded = null;
    const alignSelection = () => {
        const plane = $('.selection-plane'), row = $(`.writing-index [data-entry="${selected}"]`);
        if (!index || !plane || !row) {
            if (plane)
                plane.hidden = true;
            return;
        }
        plane.hidden = row.hidden;
        if (!row.hidden) {
            plane.style.transform = `translateY(${row.offsetTop}px)`;
            plane.style.height = row.offsetHeight + 'px';
        }
    };
    const revealControl = control => {
        if (!control?.isConnected || !control.getClientRects().length || getComputedStyle(control).visibility !== 'visible')
            return;
        const point = control.matches('[data-look]') ? $('.reader-art-label', control) || $('span', control) || control : control, box = point.getBoundingClientRect(), scroller = control.closest('dialog[open]');
        let top = 0, bottom = innerHeight;
        if (scroller) {
            const bounds = scroller.getBoundingClientRect(), bar = $('.dialog-bar', scroller);
            top = Math.max(top, bounds.top, bar?.getBoundingClientRect().bottom ?? bounds.top);
            bottom = Math.min(bottom, bounds.bottom);
        }
        else {
            const rail = $('.reading-rail');
            if (rail && getComputedStyle(rail).position === 'fixed')
                bottom = Math.min(bottom, rail.getBoundingClientRect().top);
        }
        top += 10;
        bottom -= 10;
        const delta = box.top < top ? box.top - top : box.bottom > bottom ? box.bottom - bottom : 0;
        if (box.height && delta)
            (scroller || window).scrollBy({ top: delta, behavior: 'instant' });
    };
    const renderPassages = () => {
        if (!passageHost)
            return;
        const active = document.activeElement, focused = panels.some(panel => panel !== active && panel.contains(active)) ? active : null;
        let focusedMoved = false;
        panels.forEach(panel => {
            const i = Number(panel.dataset.passage), row = $(`.writing-index [data-entry="${i}"]`);
            if (!row)
                return;
            const target = narrow.matches ? row : passageHost;
            if (panel.parentElement !== target) {
                if (focused && panel.contains(focused))
                    focusedMoved = true;
                target.append(panel);
            }
            // On phones the line invites a second reading through its image. Move the
            // existing artwork so reading and focus order follow the visible composition.
            const art = $('.artboard', panel), copy = $('.passage-copy', panel);
            if (art && copy) {
                if (narrow.matches && art.parentElement !== copy) {
                    if (focused && art.contains(focused))
                        focusedMoved = true;
                    copy.append(art);
                }
                else if (!narrow.matches && art.parentElement !== panel) {
                    if (focused && art.contains(focused))
                        focusedMoved = true;
                    panel.insertBefore(art, copy);
                }
            }
            panel.hidden = row.hidden || (narrow.matches ? expanded !== i : selected !== i);
            row.classList.toggle('expanded', !row.hidden && narrow.matches && expanded === i);
            if (!panel.hidden)
                enhanceArtwork(panel);
        });
        $$('[data-preview]').forEach(button => {
            const i = Number(button.dataset.preview), active = narrow.matches ? expanded === i : selected === i;
            button.setAttribute('aria-expanded', String(active));
            const label = $('span', button), symbol = $('.preview-symbol', button), mobileLabel = button.dataset.mobileLabel || 'A passage';
            if (label)
                label.textContent = narrow.matches ? (active ? 'Close passage' : mobileLabel) : 'A passage';
            if (symbol)
                symbol.textContent = narrow.matches ? (active ? '−' : '+') : '↳';
            if (corpus[i])
                button.setAttribute('aria-label', narrow.matches ? (active ? 'Close passage from ' : mobileLabel + ' from ') + corpus[i].title : 'Explore a passage from ' + corpus[i].title);
        });
        alignSelection();
        if (focusedMoved && focused?.isConnected && focused.getClientRects().length && getComputedStyle(focused).visibility === 'visible') {
            if (document.activeElement !== focused)
                focused.focus({ preventScroll: true });
            requestAnimationFrame(() => {
                if (document.activeElement === focused)
                    revealControl(focused);
            });
        }
    };
    const choose = i => {
        const row = $(`.writing-index [data-entry="${i}"]`), item = corpus[i];
        if (!row || row.hidden || !item)
            return;
        selected = i;
        document.body.dataset.piece = item.art ?? 'none';
        rememberSelection(item);
        $$('.writing-index [data-entry]').forEach(e => e.classList.toggle('chosen', Number(e.dataset.entry) === i));
        renderPassages();
        const status = $('[data-selection-status]');
        if (status && !narrow.matches)
            status.textContent = 'Art and passage from ' + item.title;
    };
    let lastMouse = null;
    const rememberMouse = event => { if (event.pointerType === 'mouse')
        lastMouse = { x: event.screenX, y: event.screenY }; };
    addEventListener('pointerover', event => { if (!lastMouse)
        rememberMouse(event); });
    addEventListener('pointerdown', rememberMouse);
    addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || narrow.matches)
            return;
        const previous = lastMouse;
        rememberMouse(event);
        if (!previous || (previous.x === event.screenX && previous.y === event.screenY))
            return;
        const row = event.target.closest?.('.writing-index [data-entry]');
        if (row && selected !== Number(row.dataset.entry))
            choose(Number(row.dataset.entry));
    });
    $$('.writing-index [data-entry]').forEach(row => {
        row.addEventListener('focusin', () => { if (!narrow.matches && selected !== Number(row.dataset.entry))
            choose(Number(row.dataset.entry)); });
        $('[data-preview]', row)?.addEventListener('click', event => {
            event.preventDefault();
            rememberMouse(event);
            const i = Number(row.dataset.entry);
            if (narrow.matches)
                expanded = expanded === i ? null : i;
            choose(i);
            if (narrow.matches && expanded === i) {
                const box = row.getBoundingClientRect();
                if (box.top > innerHeight * .25)
                    scrollTo({ top: Math.max(0, scrollY + box.top - 20), behavior: reduced.matches ? 'instant' : 'smooth' });
            }
        });
    });
    narrow.addEventListener('change', () => {
        const engaged = panels.some(p => p.contains(document.activeElement)) || (artDialog?.open && artTrigger && panels.some(p => p.contains(artTrigger)));
        expanded = narrow.matches && engaged ? selected : null;
        renderPassages();
    });
    fontsReady().then(alignSelection);
    addEventListener('resize', alignSelection);
    if (passageHost) {
        let remembered;
        try {
            remembered = sessionStorage.getItem(selectionKey);
        }
        catch { }
        const i = corpus.findIndex(item => item.slug === remembered), row = $(`.writing-index [data-entry="${i}"]`);
        choose(row && !row.hidden ? i : selected);
        renderPassages();
    }
    const passageStates = corpus.map(item => item.initialReading || 0);
    const setPassage = (i, next) => {
        const item = corpus[i];
        if (!item || !Array.isArray(item.quotes) || !item.quotes[next])
            return;
        passageStates[i] = next;
        $$(`[data-passage="${i}"],[data-art-detail="${i}"]`).forEach(panel => {
            panel.dataset.reading = next;
            const quote = $('[data-quote]', panel), context = $('[data-context]', panel);
            if (quote)
                quote.textContent = item.quotes[next];
            if (context)
                context.href = item.route + (item.passageIds?.[next] ? '?passage=' + encodeURIComponent(item.passageIds[next]) : '');
        });
    };
    $$('[data-another]').forEach(button => button.addEventListener('click', () => {
        const i = Number(button.dataset.another), length = corpus[i]?.quotes?.length ?? 0;
        if (length < 2)
            return;
        const active = document.activeElement;
        setPassage(i, (passageStates[i] + 1) % length);
        const status = $('[data-selection-status]');
        if (status)
            status.textContent = corpus[i].quotes[passageStates[i]];
        requestAnimationFrame(() => { if (document.activeElement === active)
            revealControl(button); });
    }));
    const finishArtClose = () => {
        if (!artActive || artDialog.open)
            return;
        artActive = false;
        document.body.style.overflow = artOverflow;
        scrollTo({ top: artScroll, behavior: 'instant' });
        artTrigger?.focus({ preventScroll: true });
        revealControl(artTrigger);
        $$('[data-study-detail]', artDialog).forEach(button => { button.closest('.detail-art')?.classList.remove('studying'); button.setAttribute('aria-pressed', 'false'); button.textContent = 'Study a detail +'; });
    };
    $$('[data-look]').forEach(trigger => {
        if (!artDialog || typeof artDialog.showModal !== 'function')
            return;
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.addEventListener('click', event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
            const i = Number(trigger.dataset.look), detail = $(`[data-art-detail="${i}"]`);
            if (!detail)
                return;
            event.preventDefault();
            finishArtClose();
            artTrigger = trigger;
            artScroll = scrollY;
            artOverflow = document.body.style.overflow;
            artActive = true;
            $$('[data-art-detail]').forEach(p => p.hidden = Number(p.dataset.artDetail) !== i);
            enhanceArtwork(detail, true);
            artDialog.showModal();
            artDialog.scrollTop = 0;
            document.body.style.overflow = 'hidden';
            $('[data-close-art]', artDialog)?.focus({ preventScroll: true });
        });
    });
    $('[data-close-art]', artDialog)?.addEventListener('click', () => artDialog.close());
    artDialog?.addEventListener('click', event => { if (event.target !== artDialog)
        return; const box = artDialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
        artDialog.close(); });
    artDialog?.addEventListener('close', finishArtClose);
    $$('[data-study-detail]').forEach(button => button.addEventListener('click', () => { const art = button.closest('.detail-art'); if (!art)
        return; const close = !art.classList.contains('studying'); art.classList.toggle('studying', close); button.setAttribute('aria-pressed', String(close)); button.textContent = close ? 'Show the whole illustration −' : 'Study a detail +'; }));
    const filter = (query, root, tag = '') => {
        const value = String(query ?? '').trim().toLocaleLowerCase();
        let count = 0;
        $$('[data-entry]', root).forEach(row => {
            const item = corpus[Number(row.dataset.entry)];
            if (!item) {
                row.hidden = true;
                return;
            }
            const matches = normalize([item.title, item.description || '', ...(item.tags || []), item.text].join(' ')).toLocaleLowerCase().includes(value) && (!tag || (item.tags || []).includes(tag));
            row.hidden = !matches;
            if (matches)
                count++;
        });
        const empty = $('.no-results', root);
        if (empty)
            empty.hidden = !!count;
        return count;
    };
    const search = $('#index-search');
    if (search && index) {
        const input = $('input[name=q]', search), tag = $('[name=tag]', search), toggle = $('[data-search-toggle]'), archive = search.dataset.archive === 'true';
        let typingEntry = false;
        const setTag = value => { if (!tag)
            return; if (tag.tagName === 'SELECT' && value && ![...tag.options].some(option => option.value === value)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            tag.append(option);
        } tag.value = value; };
        if (archive) {
            const initial = new URLSearchParams(location.search);
            if (input)
                input.value = initial.get('q') || '';
            setTag(initial.get('tag') || '');
        }
        search.hidden = !archive;
        if (toggle)
            toggle.setAttribute('aria-expanded', String(!search.hidden));
        const update = () => {
            const count = filter(input?.value || '', index, tag?.value || ''), label = $('[data-result-count]'), rows = $$('[data-entry]', index);
            if (label)
                label.textContent = count + ' of ' + rows.length + ' ' + (rows.length === 1 ? 'piece' : 'pieces');
            const first = rows.find(row => !row.hidden);
            if (passageHost)
                passageHost.hidden = !first;
            const current = $(`[data-entry="${selected}"]`, index);
            if (first && (!current || current.hidden)) {
                expanded = null;
                choose(Number(first.dataset.entry));
            }
            renderPassages();
            return count;
        };
        const syncUrl = (replace = false) => {
            if (!archive)
                return;
            const url = new URL(location.href);
            for (const [name, value] of [['q', input?.value || ''], ['tag', tag?.value || '']]) {
                if (value)
                    url.searchParams.set(name, value);
                else
                    url.searchParams.delete(name);
            }
            if (url.href !== location.href)
                history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
        };
        input?.addEventListener('input', () => { update(); syncUrl(typingEntry); typingEntry = true; });
        input?.addEventListener('blur', () => { typingEntry = false; });
        tag?.addEventListener('change', () => { typingEntry = false; update(); syncUrl(); });
        search.addEventListener('submit', event => { if (!archive)
            return; event.preventDefault(); typingEntry = false; update(); syncUrl(); });
        search.addEventListener('reset', event => { event.preventDefault(); if (input)
            input.value = ''; if (tag)
            tag.value = ''; typingEntry = false; update(); syncUrl(); input?.focus(); });
        toggle?.addEventListener('click', () => { search.hidden = !search.hidden; toggle.setAttribute('aria-expanded', String(!search.hidden)); if (!search.hidden)
            input?.focus();
        else {
            if (input)
                input.value = '';
            if (tag)
                tag.value = '';
            typingEntry = false;
            update();
            syncUrl();
        } });
        addEventListener('popstate', () => { if (!archive)
            return; const params = new URLSearchParams(location.search); if (input)
            input.value = params.get('q') || ''; setTag(params.get('tag') || ''); typingEntry = false; update(); });
        // Respect the URL and server-rendered initial filtered collection; never reset it.
        update();
    }
    const readingSettings = $('.preferences');
    const closeSettings = (returnFocus = false) => { if (!readingSettings?.open)
        return; readingSettings.open = false; if (returnFocus)
        $('summary', readingSettings)?.focus({ preventScroll: true }); };
    $('[data-close-settings]')?.addEventListener('click', () => closeSettings(true));
    addEventListener('keydown', event => { if (event.key === 'Escape' && readingSettings?.open) {
        event.preventDefault();
        closeSettings(true);
    } });
    addEventListener('pointerdown', event => { if (readingSettings?.open && !readingSettings.contains(event.target))
        closeSettings(); });
    const resetContents = () => { if (!dialog)
        return; const input = $('input', dialog), status = $('.filter-status', dialog); if (input)
        input.value = ''; filter('', dialog); if (status)
        status.textContent = ''; dialog.scrollTop = 0; };
    // Native close events are queued. Finish a closed session before reopening,
    // and ignore its delayed event while a newer session is open.
    const finishContentsClose = () => {
        if (!dialogActive || dialog.open)
            return;
        dialogActive = false;
        document.body.style.overflow = dialogOverflow;
        resetContents();
        $$('[data-contents]').forEach(e => e.setAttribute('aria-expanded', 'false'));
        scrollTo({ top: dialogScroll, behavior: 'instant' });
        dialogTrigger?.focus({ preventScroll: true });
    };
    $$('[data-contents]').forEach(trigger => {
        if (!dialog || typeof dialog.showModal !== 'function')
            return;
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.addEventListener('click', event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return; event.preventDefault(); finishContentsClose(); dialogTrigger = trigger; dialogScroll = scrollY; dialogOverflow = document.body.style.overflow; dialogActive = true; closeSettings(); resetContents(); dialog.showModal(); document.body.style.overflow = 'hidden'; trigger.setAttribute('aria-expanded', 'true'); $('[data-close]', dialog)?.focus({ preventScroll: true }); });
    });
    $('[data-close]', dialog)?.addEventListener('click', () => dialog.close());
    dialog?.addEventListener('click', event => { if (event.target !== dialog)
        return; const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
        dialog.close(); });
    dialog?.addEventListener('close', finishContentsClose);
    $('input', dialog)?.addEventListener('input', event => { const status = $('.filter-status', dialog); if (status)
        status.textContent = filter(event.target.value, dialog) + ' of ' + corpus.length + ' pieces'; });
    $$('a[aria-current=page]', dialog).forEach(a => a.addEventListener('click', event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return; event.preventDefault(); dialog.close(); }));
    const syncHomePlace = () => { const row = $('.resume-row'); if (!row)
        return; const p = readPlace(), item = p && corpus.find(x => x.slug === p.slug); row.hidden = !item; if (item) {
        const link = $('[data-resume]', row);
        if (link) {
            link.href = item.route + '?resume=1';
            link.textContent = 'Continue ' + item.title + ' ↗';
        }
    } };
    syncHomePlace();
    const reader = document.body.classList.contains('reader'), prose = $('[data-essay-prose]');
    let syncReaderPlace = () => { }, statusTimer;
    const tell = message => { const status = $('[data-save-status]') || $('[data-selection-status]'); if (!status)
        return; clearTimeout(statusTimer); status.textContent = message; if (!/could not|changed|ambiguous|unavailable/.test(message))
        statusTimer = setTimeout(() => { status.textContent = ''; }, 6000); };
    $$('[data-clear-place]').forEach(button => button.addEventListener('click', () => {
        if (privatePreview)
            return;
        if (storage.remove(placeKey)) {
            if (!reader && button.closest('.resume-row'))
                $('.writing-index a')?.focus({ preventScroll: true });
            syncHomePlace();
            syncReaderPlace();
            if (button.closest('.preferences'))
                closeSettings(true);
            tell('Saved place removed.');
        }
        else {
            tell('Your browser could not remove the saved place.');
            if (!reader)
                button.textContent = 'Could not remove. Try again.';
        }
    }));
    if (reader && prose) {
        if (!privatePreview && prose.classList.contains('poetry'))
            formatVerseLines(prose);
        const slug = document.body.dataset.slug, item = corpus.find(c => c.slug === slug);
        rememberSelection(item);
        let arrivalRun = 0;
        const waitToArrive = async () => {
            const run = ++arrivalRun;
            let cancelled = false;
            const cancel = () => { cancelled = true; }, events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
            events.forEach(name => addEventListener(name, cancel, { passive: true }));
            await fontsReady();
            events.forEach(name => removeEventListener(name, cancel));
            return !cancelled && run === arrivalRun;
        };
        const blockText = element => { let value = ''; const walk = node => { if (node.nodeType === Node.TEXT_NODE)
            value += node.data;
        else if (node.nodeName === 'BR')
            value += ' ';
        else {
            const block = /^(P|DIV|LI|BLOCKQUOTE|PRE|TABLE|H[1-6])$/.test(node.nodeName);
            if (block)
                value += ' ';
            node.childNodes.forEach(walk);
            if (block)
                value += ' ';
        } }; walk(element); return normalize(value); };
        const blocks = () => [...prose.children].filter(el => el.getBoundingClientRect().height > 0 && blockText(el));
        const readingLine = () => Math.min(90, innerHeight * .14);
        let preferences = privatePreview ? null : storage.get(prefKey);
        preferences = { size: [19, 20, 21, 22, 23, 24, 25, 26].includes(preferences?.size) ? preferences.size : matchMedia('(max-width:520px)').matches ? 20 : 22, tone: preferences?.tone === 'ink' ? 'ink' : 'paper' };
        const applyPreferences = () => { document.documentElement.style.setProperty('--text-size', preferences.size + 'px'); document.body.dataset.tone = preferences.tone; const label = $('[data-size-label]'); if (label)
            label.textContent = preferences.size; $$('button[data-tone]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tone === preferences.tone))); $$('[data-size]').forEach(b => b.disabled = Number(b.dataset.size) < 0 ? preferences.size <= 19 : preferences.size >= 26); };
        const savePreferences = () => { if (!privatePreview && !storage.set(prefKey, preferences))
            tell('Applied for this visit. Your browser could not remember the setting.'); };
        applyPreferences();
        $$('[data-size]').forEach(b => b.addEventListener('click', () => {
            const line = readingLine(), anchor = prose.getBoundingClientRect().top < line ? blocks().find(el => el.getBoundingClientRect().bottom > line) : null;
            const old = anchor?.getBoundingClientRect(), fraction = old ? Math.max(0, Math.min(1, (line - old.top) / old.height)) : 0;
            preferences.size = Math.max(19, Math.min(26, preferences.size + Number(b.dataset.size)));
            applyPreferences();
            if (anchor) {
                const next = anchor.getBoundingClientRect();
                scrollTo({ top: Math.max(0, scrollY + next.top + next.height * fraction - line), behavior: 'instant' });
            }
            savePreferences();
        }));
        $$('button[data-tone]').forEach(b => b.addEventListener('click', () => { preferences.tone = b.dataset.tone; applyPreferences(); savePreferences(); }));
        const arrive = (element, y) => { if (window.CSS?.highlights)
            CSS.highlights.delete('living-passage'); closeSettings(); element.tabIndex = -1; element.focus({ preventScroll: true }); scrollTo({ top: Math.max(0, y), behavior: 'instant' }); };
        const clearQuery = name => { const url = new URL(location.href); url.searchParams.delete(name); history.replaceState(history.state, '', url); };
        const restore = async () => {
            const p = readPlace();
            if (!item || !p || p.slug !== slug) {
                tell('No saved place in this piece.');
                return;
            }
            if (!await waitToArrive())
                return;
            const all = blocks(), matches = all.filter(el => { const value = blockText(el); return hash(value) === p.hash && value === p.text; });
            // Occurrence is meaningful only while the set of identical blocks is intact.
            if (matches.length !== p.matches || !matches[p.occurrence] || (p.matches > 1 && p.sequenceHash !== hash(JSON.stringify(all.map(blockText))))) {
                tell('This piece has changed. The saved paragraph is missing or ambiguous; choose a new place.');
                return;
            }
            const element = matches[p.occurrence], box = element.getBoundingClientRect();
            arrive(element, scrollY + box.top + box.height * p.fraction - readingLine());
            tell('At your saved place.');
            clearQuery('resume');
        };
        syncReaderPlace = () => { const p = readPlace(), matches = !privatePreview && p?.slug === slug; for (const node of [$('[data-restore]'), $('.reading-rail [data-clear-place]')])
            if (node)
                node.hidden = !matches; };
        syncReaderPlace();
        $('[data-restore]')?.addEventListener('click', restore);
        $('[data-save]')?.addEventListener('click', () => {
            if (privatePreview || !item)
                return;
            const all = blocks();
            if (!all.length) {
                tell('There is no reading place to save yet.');
                return;
            }
            const line = readingLine(), element = all.find(el => el.getBoundingClientRect().bottom > line) || all.at(-1), box = element.getBoundingClientRect(), value = blockText(element), matches = all.filter(el => blockText(el) === value);
            const p = { slug, postId: item.id, hash: hash(value), text: value, occurrence: matches.indexOf(element), matches: matches.length, sequenceHash: hash(JSON.stringify(all.map(blockText))), fraction: Math.max(0, Math.min(1, (line - box.top) / Math.max(1, box.height))) };
            if (storage.set(placeKey, p)) {
                syncReaderPlace();
                tell('This place is saved on this browser.');
            }
            else
                tell('Your browser could not save this place. Keep this page open.');
        });
        const query = new URLSearchParams(location.search);
        if (!privatePreview && item && query.has('passage'))
            waitToArrive().then(allowed => {
                if (!allowed)
                    return;
                const id = query.get('passage'), indices = (item.passageIds || []).flatMap((candidate, i) => candidate === id ? [i] : []);
                if (!/^p-[a-z0-9]+$/.test(id || '') || indices.length !== 1) {
                    tell('That passage link is unavailable for this version of the piece.');
                    return;
                }
                const quote = normalize(item.quotes[indices[0]]);
                if (!quote || 'p-' + hash(quote) !== id) {
                    tell('That passage link is unavailable for this version of the piece.');
                    return;
                }
                let content = '', positions = [], space = false;
                const append = (char, node, offset) => { if (/\s/.test(char)) {
                    if (!space) {
                        content += ' ';
                        positions.push(node ? [node, offset] : null);
                        space = true;
                    }
                }
                else {
                    content += char;
                    positions.push([node, offset]);
                    space = false;
                } };
                const walk = node => { if (node.nodeType === Node.TEXT_NODE) {
                    for (let offset = 0; offset < node.length; offset++)
                        append(node.data[offset], node, offset);
                }
                else if (node.nodeName === 'BR')
                    append(' ', null, 0);
                else {
                    const block = /^(P|DIV|LI|BLOCKQUOTE|PRE|TABLE|H[1-6])$/.test(node.nodeName);
                    if (block)
                        append(' ', null, 0);
                    node.childNodes.forEach(walk);
                    if (block)
                        append(' ', null, 0);
                } };
                walk(prose);
                const start = content.indexOf(quote), last = start + quote.length - 1;
                if (start < 0 || content.indexOf(quote, start + 1) >= 0 || !positions[start] || !positions[last]) {
                    tell('The selected passage has changed or is ambiguous in this version of the piece.');
                    return;
                }
                const [first, offset] = positions[start], [end, endOffset] = positions[last], range = document.createRange();
                range.setStart(first, offset);
                range.setEnd(first, offset + 1);
                let block = first.parentElement;
                while (block && block.parentElement !== prose)
                    block = block.parentElement;
                if (!block)
                    return;
                arrive(block, scrollY + range.getBoundingClientRect().top - readingLine());
                range.setEnd(end, endOffset + 1);
                if (window.CSS?.highlights && typeof Highlight === 'function')
                    CSS.highlights.set('living-passage', new Highlight(range));
                tell('The selected passage.');
                clearQuery('passage');
            });
        else if (!privatePreview && item && query.has('resume'))
            restore();
    }
    addEventListener('pageshow', () => { syncHomePlace(); syncReaderPlace(); alignSelection(); });
    addEventListener('storage', event => { if (!privatePreview && event.key === placeKey) {
        syncHomePlace();
        syncReaderPlace();
    } });
    addEventListener('beforeprint', () => { if (dialog?.open)
        dialog.close(); if (artDialog?.open)
        artDialog.close(); document.body.style.overflow = ''; });
})();
