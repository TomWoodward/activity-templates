import { h } from '../dom.js';
import { button } from './form.js';

// Status area in the controls footer. show() takes message strings; falsy ones are skipped.
export function createStatus() {
  const el = h('div', { class: 'status', role: 'status' });
  return {
    el,
    show(...messages) {
      el.replaceChildren(...messages.filter(Boolean).map((m) => h('p', { class: 'status__msg' }, m)));
    },
  };
}

// Standard activity page: a controls panel (scrolling settings, plus a footer
// with status messages and action buttons) beside the page preview.
// A Print button is always added as the last action.
export function activityWorkspace({ title, controls, status, actions = [], preview }) {
  return h('div', { class: 'workspace' },
    h('aside', { class: 'controls no-print' },
      h('div', { class: 'controls__body' },
        h('a', { class: 'back-link', href: '#/' }, '← All activities'),
        h('h1', { class: 'controls__title' }, title),
        ...controls,
      ),
      h('div', { class: 'controls__footer' },
        status.el,
        h('div', { class: 'controls__actions' },
          ...actions,
          button('Print', () => window.print(), { primary: true }),
        ),
      ),
    ),
    preview.el,
  );
}
