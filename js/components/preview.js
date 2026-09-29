import { h } from '../dom.js';

const SHEET_WIDTH_PX = 8.5 * 96;

// On-screen stack of printable sheets. Scales sheets down to fit narrow
// screens; print always uses full size.
export function createPreview() {
  const el = h('div', { class: 'preview' });

  new ResizeObserver(([entry]) => {
    const scale = Math.min(1, entry.contentRect.width / SHEET_WIDTH_PX);
    el.style.setProperty('--preview-scale', scale.toFixed(4));
  }).observe(el);

  // pages: [{ label, sheet }]
  function show(pages) {
    el.replaceChildren(...pages.map(({ label, sheet }, i) =>
      h('figure', { class: 'preview__page' },
        h('figcaption', { class: 'preview__label no-print' },
          `Page ${i + 1} of ${pages.length}`,
          label && h('span', { class: 'preview__label-name' }, label),
        ),
        sheet,
      ),
    ));
  }

  return { el, show };
}
