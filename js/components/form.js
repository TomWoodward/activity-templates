import { h } from '../dom.js';
import { MARGIN_RANGE } from './sheet.js';

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

// Number input that updates live while typing valid values, and clamps and
// snaps to `step` on blur.
export function numberInput({ value, min, max, step = 1, onvalue }) {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const snap = (n) => Number((Math.round(n / step) * step).toFixed(decimals));
  const read = (input) => (input.value === '' ? NaN : Number(input.value));
  return h('input', {
    type: 'number',
    inputMode: step < 1 ? 'decimal' : 'numeric',
    min,
    max,
    step,
    value,
    oninput: (e) => {
      const n = read(e.target);
      if (n >= min && n <= max) onvalue(snap(n));
    },
    onchange: (e) => {
      const n = read(e.target);
      const clamped = snap(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));
      e.target.value = clamped;
      onvalue(clamped);
    },
  });
}

// Top/Bottom/Left/Right page margin inputs. `margins` is mutated in place,
// then onchange() is called.
export function marginFields(margins, onchange) {
  const side = (label, key) => field(label, numberInput({
    value: margins[key],
    ...MARGIN_RANGE,
    onvalue: (n) => { margins[key] = n; onchange(); },
  }));
  return h('div', { class: 'field-group' },
    h('div', { class: 'field__label' }, 'Page margins (inches)'),
    h('div', { class: 'field-row' }, side('Top', 'top'), side('Bottom', 'bottom')),
    h('div', { class: 'field-row' }, side('Left', 'left'), side('Right', 'right')),
    h('div', { class: 'field__hint' },
      `${MARGIN_RANGE.min}–${MARGIN_RANGE.max}in. Leave margins on "Default" in the print dialog.`),
  );
}

// The standard "Advanced" group: page margins and the Name/Date toggle, plus
// any activity-specific extras. Reads and mutates `settings` (see
// defaultPageSettings() in sheet.js), then calls onchange().
export function advancedSettings(settings, onchange, ...extra) {
  return disclosure('Advanced',
    marginFields(settings.margins, onchange),
    checkbox('Name and date lines', settings.showNameDate, (v) => { settings.showNameDate = v; onchange(); }),
    ...extra,
  );
}

// Collapsible group for less-used settings. Starts closed.
export function disclosure(title, ...children) {
  return h('details', { class: 'disclosure' },
    h('summary', { class: 'disclosure__summary' }, title),
    h('div', { class: 'disclosure__body' }, ...children),
  );
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
