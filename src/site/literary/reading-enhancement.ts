import { formatVerseLines, POETRY_BREAK_THRESHOLD } from './typography';
const prose = document.querySelector<HTMLElement>('[data-essay-prose]');
if (prose) {
    // A keyboard user must be able to pan long code and tables. Keep ordinary
    // blocks out of Tab order, and retain any author-provided semantics.
    const scrollableBlocks = new Map<HTMLElement, {
        tabindex: string | null;
        role: string | null;
        label: string | null;
    }>();
    function updateScrollableBlocks() {
        for (const [element, original] of scrollableBlocks) {
            if (!prose?.contains(element)) {
                scrollableBlocks.delete(element);
                continue;
            }
            const overflowing = element.scrollWidth > element.clientWidth + 2;
            if (original.tabindex === null) {
                if (overflowing)
                    element.setAttribute('tabindex', '0');
                else
                    element.removeAttribute('tabindex');
            }
            if (original.role === null && element.tagName === 'PRE') {
                if (overflowing)
                    element.setAttribute('role', 'region');
                else
                    element.removeAttribute('role');
            }
            if (original.label === null && !element.hasAttribute('aria-labelledby') && !element.querySelector('caption')) {
                if (overflowing)
                    element.setAttribute('aria-label', element.tagName === 'PRE' ? 'Code block, scroll horizontally' : 'Table, scroll horizontally');
                else
                    element.removeAttribute('aria-label');
            }
        }
    }
    let queued = false;
    function scheduleOverflow() { if (!queued) {
        queued = true;
        requestAnimationFrame(() => { queued = false; updateScrollableBlocks(); });
    } }
    function discoverScrollableBlocks() {
        prose?.querySelectorAll<HTMLElement>('pre,table').forEach(element => {
            if (!scrollableBlocks.has(element))
                scrollableBlocks.set(element, { tabindex: element.getAttribute('tabindex'), role: element.getAttribute('role'), label: element.getAttribute('aria-label') });
        });
        scheduleOverflow();
    }
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleOverflow) : null;
    resizeObserver?.observe(prose);
    // The private preview replaces its article after load. Enhance the new blocks too.
    const contentObserver = new MutationObserver(discoverScrollableBlocks);
    contentObserver.observe(prose, { childList: true, subtree: true });
    addEventListener('resize', scheduleOverflow);
    document.fonts.ready.then(scheduleOverflow);
    discoverScrollableBlocks();
    // Notes remain native links; focus follows the destination for keyboard readers,
    // including when the private preview has just mounted fresh content.
    prose.addEventListener('click', event => {
        if (!(event.target instanceof Element) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const link = event.target.closest<HTMLAnchorElement>('a[data-footnote-ref],a[data-footnote-backref]');
        if (!link?.hash)
            return;
        const id = decodeURIComponent(link.hash.slice(1));
        const target = document.getElementById(id);
        if (target instanceof HTMLElement && prose.contains(target))
            requestAnimationFrame(() => { if (!target.hasAttribute('tabindex'))
                target.tabIndex = -1; target.focus({ preventScroll: true }); });
    });
    const progressNode = document.querySelector<HTMLElement>('[data-reading-progress]');
    function progress() { if (!prose || !progressNode)
        return; const r = prose.getBoundingClientRect(); const amount = Math.max(0, Math.min(100, (-r.top + innerHeight * .25) / Math.max(1, prose.offsetHeight - innerHeight * .5) * 100)); progressNode.style.width = amount + '%'; }
    let frame = 0;
    const schedule = () => { if (!frame)
        frame = requestAnimationFrame(() => { frame = 0; progress(); }); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    document.fonts.ready.then(schedule);
    new ResizeObserver(schedule).observe(prose);
    schedule();
    // Private preview content is replaced after load. Format line wraps without
    // removing a single original break or inline node, and without persistence.
    const formatPreview = () => {
        if (!document.body.hasAttribute('data-private-preview') || !prose)
            return;
        const poetry = prose.querySelectorAll('br').length >= POETRY_BREAK_THRESHOLD;
        prose.classList.toggle('poetry', poetry);
        prose.classList.toggle('verse-formatted', poetry);
        if (poetry)
            formatVerseLines(prose);
    };
    new MutationObserver(formatPreview).observe(prose, { childList: true, subtree: true });
    formatPreview();
}
export {};
