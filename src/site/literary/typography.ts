/** Keep the saved reader and unsaved preview on the same title/poetry rules. */
export const POETRY_BREAK_THRESHOLD = 8;
export const isLongTitle = (title: string) => title.length > 40;
export const isPoetry = (html: string) =>
  (html.match(/<br\s*\/?\s*>/gi) || []).length >= POETRY_BREAK_THRESHOLD;

/** Indent soft wraps while retaining every original node and authored line break. */
export function formatVerseLines(prose: HTMLElement) {
  prose.classList.add('verse-formatted');
  prose.querySelectorAll('p').forEach(paragraph => {
    // Preview replacements can be observed more than once; never nest wrappers.
    if (paragraph.querySelector('.verse-line')) return;
    const fragment = document.createDocumentFragment();
    let line = document.createElement('span');
    line.className = 'verse-line';
    const flush = () => {
      if (!line.textContent?.trim()) line.dataset.blank = '';
      fragment.appendChild(line);
      line = document.createElement('span');
      line.className = 'verse-line';
    };
    [...paragraph.childNodes].forEach(node => {
      if (node.nodeName === 'BR') {
        flush();
        fragment.appendChild(node);
      } else line.appendChild(node);
    });
    if (line.textContent?.trim() || line.children.length) flush();
    else [...line.childNodes].forEach(node => fragment.appendChild(node));
    paragraph.replaceChildren(fragment);
  });
}
