import { h } from '../dom.js';

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
