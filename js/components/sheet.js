import { h } from '../dom.js';

// US Letter, in inches.
export const PAGE_WIDTH_IN = 8.5;
export const PAGE_HEIGHT_IN = 11;
export const MARGIN_SIDES = ['top', 'right', 'bottom', 'left'];
export const DEFAULT_MARGINS = Object.freeze({ top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 });
export const MARGIN_RANGE = { min: 0.25, max: 1.5, step: 0.05 };

// Area inside the margins ({ top, right, bottom, left } in inches).
// Size printed content to fit this.
export function printableArea(margins) {
  return {
    width: PAGE_WIDTH_IN - margins.left - margins.right,
    height: PAGE_HEIGHT_IN - margins.top - margins.bottom,
  };
}

// Applies margins both in print (@page) and on the on-screen sheet
// (--page-margin-*). Must match what the layout math assumed.
let marginStyle;
export function setPageMargins(margins) {
  const sides = MARGIN_SIDES.map((side) => `${margins[side]}in`);
  const vars = MARGIN_SIDES.map((side, i) => `--page-margin-${side}: ${sides[i]};`).join(' ');
  marginStyle ??= document.head.appendChild(h('style', { id: 'page-margins' }));
  marginStyle.textContent = `@page { margin: ${sides.join(' ')}; } :root { ${vars} }`;
}

// A single printable page. Each sheet prints on its own page.
export function sheet(...children) {
  return h('section', { class: 'sheet' }, ...children);
}

// Standard worksheet header: title plus fill-in-the-blank fields.
export function sheetHeader({ title, subtitle, fields = ['Name', 'Date'] }) {
  return h('header', { class: 'sheet-header' },
    fields.length > 0 && h('div', { class: 'sheet-header__fields' },
      fields.map((label) =>
        h('div', { class: 'sheet-header__field' },
          h('span', { class: 'sheet-header__label' }, `${label}:`),
          h('span', { class: 'sheet-header__blank' }),
        ),
      ),
    ),
    title && h('h1', { class: 'sheet-header__title' }, title),
    subtitle && h('p', { class: 'sheet-header__subtitle' }, subtitle),
  );
}
