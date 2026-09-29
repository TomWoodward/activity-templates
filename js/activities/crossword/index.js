import { h, svg } from '../../dom.js';
import {
  sheet, sheetHeader, studentHeader, sheetHeaderHeight, printableArea, setPageMargins, defaultPageSettings,
} from '../../components/sheet.js';
import { createPreview } from '../../components/preview.js';
import { activityWorkspace, createStatus } from '../../components/workspace.js';
import { section, field, checkbox, segmented, button, advancedSettings } from '../../components/form.js';
import { parseWordList } from '../../lib/words.js';
import { generateCrossword, gridLines } from './generator.js';

const MAX_LAYOUT_SIZE = 25; // max rows/cols of the generated grid
const MAX_CELL_IN = 0.45;
const MIN_READABLE_CELL_IN = 0.3; // below this, move clues to their own page, then warn
const CSS_PX_PER_IN = 96;

// Estimated heights of the clue list, in inches. Keep in sync with .cw-clues styles.
const CLUES_TOP_IN = 0.25 + 0.45; // gap above the list + column heading
const BLANK_CLUE_IN = 0.4;
const TEXT_LINE_IN = 0.22;
const CLUE_GAP_IN = 0.08;
const CLUE_COLUMN_GAP_IN = 0.4;
const CHARS_PER_IN = 13; // rough, for 11pt serif text
const ANSWER_LINE_IN = 0.3;

const DIRECTIONS = [['across', 'Across'], ['down', 'Down']];

function defaultState() {
  return {
    title: 'Crossword',
    wordsText: '',
    clueMode: 'handwritten', // 'handwritten' | 'typed'
    clues: {}, // word letters -> clue text, so clues survive re-shuffling
    answerKey: true,
    ...defaultPageSettings(),
  };
}

function clueText(state, entry) {
  return state.clueMode === 'typed' ? (state.clues[entry.letters] ?? '').trim() : '';
}

function entriesFor(puzzle, direction) {
  return puzzle.entries.filter((e) => e.direction === direction);
}

function cluesHeight(state, puzzle) {
  const colWidth = (printableArea(state.margins).width - CLUE_COLUMN_GAP_IN) / 2;
  const itemHeight = (entry) => {
    const text = clueText(state, entry);
    if (!text) return BLANK_CLUE_IN;
    return Math.ceil((text.length + 4) / (colWidth * CHARS_PER_IN)) * TEXT_LINE_IN + CLUE_GAP_IN;
  };
  const column = (dir) => entriesFor(puzzle, dir).reduce((sum, e) => sum + itemHeight(e), 0);
  return CLUES_TOP_IN + Math.max(column('across'), column('down'));
}

function answersHeight(puzzle) {
  const longest = Math.max(entriesFor(puzzle, 'across').length, entriesFor(puzzle, 'down').length);
  return CLUES_TOP_IN + longest * ANSWER_LINE_IN;
}

function fitCell(state, puzzle, reservedHeightIn) {
  const { width, height } = printableArea(state.margins);
  return Math.min(MAX_CELL_IN, width / puzzle.cols, (height - reservedHeightIn) / puzzle.rows);
}

// Grid and clues share a page unless that makes the grid too small to write in.
function puzzleLayout(state, puzzle) {
  const header = sheetHeaderHeight(state);
  const together = fitCell(state, puzzle, header + cluesHeight(state, puzzle));
  if (together >= MIN_READABLE_CELL_IN) return { cellIn: together, cluesOnOwnPage: false };
  return { cellIn: fitCell(state, puzzle, header), cluesOnOwnPage: true };
}

function keyLayout(state, puzzle) {
  const header = sheetHeaderHeight({ showNameDate: false });
  const withAnswers = fitCell(state, puzzle, header + answersHeight(puzzle));
  if (withAnswers >= MIN_READABLE_CELL_IN) return { cellIn: withAnswers, showAnswers: true };
  return { cellIn: fitCell(state, puzzle, header), showAnswers: false };
}

function gridView(puzzle, cellIn, { showLetters = false } = {}) {
  const numbers = new Map(puzzle.entries.map((e) => [`${e.row},${e.col}`, e.number]));
  const cells = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const letter = puzzle.grid[r][c];
      const number = numbers.get(`${r},${c}`);
      cells.push(letter
        ? h('div', { class: 'cw-cell' },
          number && h('span', { class: 'cw-num' }, number),
          showLetters && h('span', { class: 'cw-letter' }, letter))
        : h('div', { class: 'cw-empty' }));
    }
  }
  // Lines are one SVG rather than CSS borders, so every line sits exactly on a
  // cell boundary and is drawn once (CSS borders drift by a pixel). No viewBox:
  // coordinates are CSS px, so stroke-width is a plain length the CSS can adjust
  // for the preview's zoom (see .cw-lines in app.css).
  const px = cellIn * CSS_PX_PER_IN;
  const { horizontal, vertical } = gridLines(puzzle.grid);
  const d = [
    ...horizontal.map(({ y, x1, x2 }) => `M${x1 * px} ${y * px}H${x2 * px}`),
    ...vertical.map(({ x, y1, y2 }) => `M${x * px} ${y1 * px}V${y2 * px}`),
  ].join('');
  const lines = svg('svg', { class: 'cw-lines', 'aria-hidden': 'true' }, svg('path', { d }));

  return h('div', {
    class: 'cw-grid',
    style: { '--cols': puzzle.cols, '--rows': puzzle.rows, '--cell': `${cellIn}in` },
  }, cells, lines);
}

// Across/Down columns. With `answers`, lists the answer words instead of clues.
function cluesView(state, puzzle, { answers = false } = {}) {
  return h('section', { class: 'cw-clues' },
    DIRECTIONS.map(([dir, heading]) =>
      h('div', { class: 'cw-clues__col' },
        h('h2', { class: 'cw-clues__heading' }, heading),
        h('ol', { class: 'cw-clues__list' },
          entriesFor(puzzle, dir).map((entry) => {
            const text = answers ? entry.display.toLocaleUpperCase() : clueText(state, entry);
            return h('li', { class: 'cw-clue' },
              h('span', { class: 'cw-clue__num' }, `${entry.number}.`),
              text ? h('span', { class: 'cw-clue__text' }, text) : h('span', { class: 'cw-clue__blank' }),
            );
          }),
        ),
      ),
    ),
  );
}

function pages(state, puzzle) {
  if (puzzle.entries.length === 0) {
    return [{
      label: 'Puzzle',
      sheet: sheet(
        studentHeader(state),
        h('p', { class: 'sheet-placeholder no-print' }, 'Add words to build your crossword.'),
      ),
    }];
  }

  const { cellIn, cluesOnOwnPage } = puzzleLayout(state, puzzle);
  const result = [{
    label: 'Puzzle',
    sheet: sheet(
      studentHeader(state),
      gridView(puzzle, cellIn),
      !cluesOnOwnPage && cluesView(state, puzzle),
    ),
  }];
  if (cluesOnOwnPage) {
    result.push({
      label: 'Clues',
      sheet: sheet(sheetHeader({ title: `${state.title} — Clues`, fields: [] }), cluesView(state, puzzle)),
    });
  }
  if (state.answerKey) {
    const key = keyLayout(state, puzzle);
    result.push({
      label: 'Answer key',
      sheet: sheet(
        sheetHeader({ title: `${state.title} — Answer Key`, fields: [] }),
        gridView(puzzle, key.cellIn, { showLetters: true }),
        key.showAnswers && cluesView(state, puzzle, { answers: true }),
      ),
    });
  }
  return result;
}

function render(container) {
  const state = defaultState();
  let puzzle = generateCrossword({ words: [] });
  let puzzleKey = '';

  const preview = createPreview();
  const status = createStatus();
  const wordCount = h('span');
  const clueList = h('div', { class: 'clue-editor' });

  // Clue boxes are rebuilt only when the layout changes, so typing a clue keeps focus.
  function renderClueEditor() {
    if (puzzle.entries.length === 0) {
      clueList.replaceChildren(h('div', { class: 'field__hint' }, 'Clue boxes appear here once you add words.'));
      return;
    }
    clueList.replaceChildren(
      ...DIRECTIONS.flatMap(([dir, heading]) => entriesFor(puzzle, dir).map((entry) =>
        field(`${entry.number} ${heading} · ${entry.display.toLocaleUpperCase()}`, h('input', {
          type: 'text',
          value: state.clues[entry.letters] ?? '',
          oninput: (e) => { state.clues[entry.letters] = e.target.value; update(); },
        })),
      )),
      h('div', { class: 'field__hint' }, 'Leave a clue empty to print a blank line for it.'),
    );
  }

  function update({ regenerate = false } = {}) {
    setPageMargins(state.margins);
    clueList.hidden = state.clueMode !== 'typed';

    const words = parseWordList(state.wordsText);
    const key = JSON.stringify(words.map((w) => w.letters));
    if (regenerate || key !== puzzleKey) {
      puzzle = generateCrossword({ words, maxSize: MAX_LAYOUT_SIZE });
      puzzleKey = key;
      renderClueEditor();
    }

    wordCount.textContent = words.length === 0
      ? 'One per line, or separated by commas.'
      : `${puzzle.entries.length} of ${words.length} words placed.`;

    const messages = [];
    if (words.length === 1) messages.push('Add more words. Each word needs a letter in common with another.');
    if (puzzle.unplaced.length > 0 && words.length > 1) {
      messages.push(`Couldn't fit: ${puzzle.unplaced.map((w) => w.display).join(', ')}. `
        + `Each word needs 2–${MAX_LAYOUT_SIZE} letters and a letter in common with the puzzle. Try Shuffle or different words.`);
    }
    if (puzzle.entries.length > 0) {
      const { cellIn } = puzzleLayout(state, puzzle);
      if (cellIn < MIN_READABLE_CELL_IN) {
        messages.push(`Grid squares are only ${cellIn.toFixed(2)}in wide, which may be hard to write in. `
          + 'Try Shuffle, fewer or shorter words, or smaller margins.');
      }
    }
    status.show(...messages);
    preview.show(pages(state, puzzle));
  }

  let typingTimer;
  const updateSoon = () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => update(), 250);
  };

  container.append(activityWorkspace({
    title: 'Crossword',
    preview,
    status,
    actions: [button('Shuffle', () => update({ regenerate: true }))],
    controls: [
      section('Page',
        field('Title', h('input', {
          type: 'text',
          value: state.title,
          oninput: (e) => { state.title = e.target.value; update(); },
        })),
      ),
      section('Words',
        field('Answer words', h('textarea', {
          rows: 7,
          placeholder: 'nucleus\nmitosis\nenzyme',
          spellcheck: true,
          oninput: (e) => { state.wordsText = e.target.value; updateSoon(); },
        }), wordCount),
      ),
      section('Clues',
        segmented({
          label: 'Clue type',
          value: state.clueMode,
          options: [
            { value: 'handwritten', label: 'Handwritten' },
            { value: 'typed', label: 'Typed' },
          ],
          onchange: (v) => { state.clueMode = v; update(); },
        }),
        clueList,
      ),
      section('Include',
        checkbox('Answer key page', state.answerKey, (v) => { state.answerKey = v; update(); }),
      ),
      advancedSettings(state, () => update()),
    ],
  }));
  renderClueEditor();
  update();
}

export default {
  id: 'crossword',
  name: 'Crossword',
  description: 'Enter answer words and get a numbered crossword grid. Type the clues in, or print blank lines to write them by hand.',
  render,
};
