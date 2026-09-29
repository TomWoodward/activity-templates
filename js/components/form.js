import { h } from '../dom.js';

// Shared control-panel building blocks for activity pages.

let nextId = 0;
const uid = (prefix) => `${prefix}-${++nextId}`;

export function section(title, ...children) {
  return h('section', { class: 'panel-section' },
    title && h('h2', { class: 'panel-section__title' }, title),
    ...children,
  );
}

// Wraps a control with a label. `control` gets an id/name if it lacks one.
export function field(label, control, hint) {
  if (!control.id) control.id = uid('field');
  if (!control.name) control.name = control.id;
  return h('div', { class: 'field' },
    h('label', { class: 'field__label', for: control.id }, label),
    control,
    hint && h('div', { class: 'field__hint' }, hint),
  );
}

// Number input that updates live while typing valid values and clamps on blur.
export function numberInput({ value, min, max, onvalue }) {
  const valid = (n) => Number.isInteger(n) && n >= min && n <= max;
  return h('input', {
    type: 'number',
    inputMode: 'numeric',
    min,
    max,
    value,
    oninput: (e) => {
      const n = parseInt(e.target.value, 10);
      if (valid(n)) onvalue(n);
    },
    onchange: (e) => {
      const n = parseInt(e.target.value, 10);
      const clamped = Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
      e.target.value = clamped;
      onvalue(clamped);
    },
  });
}

export function checkbox(label, checked, onchange, { variant = 'check' } = {}) {
  return h('label', { class: variant },
    h('input', { type: 'checkbox', name: uid('check'), checked, onchange: (e) => onchange(e.target.checked) }),
    h('span', {}, label),
  );
}

// Radio group styled as a two-or-more-way toggle.
export function segmented({ label, options, value, onchange }) {
  const name = uid('seg');
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label },
    options.map((opt) =>
      h('label', { class: 'segmented__option' },
        h('input', {
          type: 'radio',
          name,
          value: opt.value,
          checked: opt.value === value,
          onchange: () => onchange(opt.value),
        }),
        h('span', {}, opt.label),
      ),
    ),
  );
}

export function button(label, onclick, { primary = false } = {}) {
  return h('button', { type: 'button', class: `button${primary ? ' button--primary' : ''}`, onclick }, label);
}
