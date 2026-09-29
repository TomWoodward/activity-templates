import { h, svg } from '../../dom.js';
import { sheet, sheetHeader } from '../../components/sheet.js';
import { createPreview } from '../../components/preview.js';
import { section, field, numberInput, checkbox, segmented, button } from '../../components/form.js';
import { parseWordList, generatePuzzle, answerCells } from './generator.js';

const MIN_SIZE = 5;
const MAX_SIZE = 30;

// Printable area of a US Letter page with 0.5in margins, in inches.
const PAGE_WIDTH_IN = 7.5;
const PAGE_HEIGHT_IN = 10;
const HEADER_HEIGHT_IN = 1.4;
const MAX_CELL_IN = 0.5;
const WORD_BANK_COLUMNS = 3;

function defaultState() {
  return {
    title: 'Word Search',
    rows: 15,
    cols: 15,
    mode: 'blank', // 'blank' | 'words'
    wordsText: '',
    directions: { horizontal: true, vertical: true, diagonal: true, backwards: false },
    showWordBank: true,
    answerKey: true,
    blankLines: 12,
  };
}

// Largest square cell that fits the grid plus everything else on the page.
function cellSize(rows, cols, reservedHeightIn) {
  return Math.min(MAX_CELL_IN, PAGE_WIDTH_IN / cols, (PAGE_HEIGHT_IN - reservedHeightIn) / rows);
}

function wordBankHeight(itemCount, lineHeightIn) {
  if (itemCount === 0) return 0;
  return 0.5 + Math.ceil(itemCount / WORD_BANK_COLUMNS) * lineHeightIn;
}

function gridView({ rows, cols, letters, cellIn, lined = false, placements = null }) {
  const highlighted = placements ? answerCells(placements) : null;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isAnswer = highlighted?.has(`${r},${c}`);
      cells.push(h('div', {
        class: ['ws-cell', highlighted && !isAnswer && 'ws-cell--filler'].filter(Boolean).join(' '),
      }, letters ? letters[r][c] : ''));
    }
  }

  const overlay = placements && svg('svg', {
    class: 'ws-overlay',
    viewBox: `0 0 ${cols} ${rows}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  }, ...placements.map(({ row, col, dr, dc, length }) => svg('line', {
    x1: col + 0.5,
    y1: row + 0.5,
    x2: col + dc * (length - 1) + 0.5,
    y2: row + dr * (length - 1) + 0.5,
  })));

  return h('div', { class: `ws-frame${lined ? ' ws-frame--lined' : ''}` },
    h('div', {
      class: 'ws-grid',
      style: {
        '--cols': cols,
        '--rows': rows,
        '--cell': `${cellIn}in`,
      },
    }, cells, overlay),
  );
}

function wordBankView({ words, blankLines }) {
  const items = words
    ? words.map((w) => h('li', {}, w.display.toLocaleUpperCase()))
    : Array.from({ length: blankLines }, () => h('li', { class: 'word-bank__blank' }));
  return h('section', { class: 'word-bank' },
    h('h2', { class: 'word-bank__title' }, 'Word Bank'),
    h('ul', {
      class: 'word-bank__list',
      style: { '--bank-cols': WORD_BANK_COLUMNS, '--bank-rows': Math.ceil(items.length / WORD_BANK_COLUMNS) },
    }, items),
  );
}

function blankSheets(state) {
  const reserved = HEADER_HEIGHT_IN + wordBankHeight(state.blankLines, 0.45);
  return [{
    label: 'Blank template',
    sheet: sheet(
      sheetHeader({ title: state.title }),
      gridView({ rows: state.rows, cols: state.cols, cellIn: cellSize(state.rows, state.cols, reserved), lined: true }),
      state.blankLines > 0 && wordBankView({ blankLines: state.blankLines }),
    ),
  }];
}

function puzzleSheets(state, puzzle) {
  const bankWords = state.showWordBank ? puzzle.placements : [];
  const reserved = HEADER_HEIGHT_IN + wordBankHeight(bankWords.length, 0.3);
  const cellIn = cellSize(state.rows, state.cols, reserved);
  const grid = { rows: state.rows, cols: state.cols, letters: puzzle.grid, cellIn };

  const pages = [{
    label: 'Puzzle',
    sheet: sheet(
      sheetHeader({ title: state.title }),
      gridView(grid),
      bankWords.length > 0 && wordBankView({ words: bankWords }),
    ),
  }];
  if (state.answerKey) {
    pages.push({
      label: 'Answer key',
      sheet: sheet(
        sheetHeader({ title: `${state.title} — Answer Key`, fields: [] }),
        gridView({ ...grid, placements: puzzle.placements }),
      ),
    });
  }
  return pages;
}


function render(container) {
  const state = defaultState();
  let puzzle = null;
  let puzzleKey = '';

  const preview = createPreview();
  const status = h('div', { class: 'status', role: 'status' });
  const wordCount = h('span');
  const blankPanel = h('div', { class: 'mode-panel' });
  const wordsPanel = h('div', { class: 'mode-panel' });
  const shuffleButton = button('Shuffle', () => update({ regenerate: true }));

  // Rebuild the puzzle only when something that affects letter placement changed.
  function currentPuzzle(force) {
    const words = parseWordList(state.wordsText);
    const key = JSON.stringify([state.rows, state.cols, words.map((w) => w.letters), state.directions]);
    if (force || key !== puzzleKey) {
      puzzle = generatePuzzle({ rows: state.rows, cols: state.cols, words, directions: state.directions });
      puzzleKey = key;
    }
    return { puzzle, words };
  }

  function update({ regenerate = false } = {}) {
    const isWords = state.mode === 'words';
    wordsPanel.hidden = !isWords;
    blankPanel.hidden = isWords;
    shuffleButton.hidden = !isWords;

    if (!isWords) {
      status.replaceChildren();
      preview.show(blankSheets(state));
      return;
    }

    const { puzzle, words } = currentPuzzle(regenerate);
    wordCount.textContent = words.length === 0
      ? 'One per line, or separated by commas.'
      : `${puzzle.placements.length} of ${words.length} words placed.`;

    const messages = [];
    const { horizontal, vertical, diagonal } = state.directions;
    if (!horizontal && !vertical && !diagonal) {
      messages.push('Turn on at least one of Across, Down, or Diagonal.');
    }
    if (words.length > 0 && puzzle.unplaced.length > 0) {
      messages.push(`Couldn't fit: ${puzzle.unplaced.map((w) => w.display).join(', ')}. Try a bigger grid or more directions.`);
    }
    status.replaceChildren(...messages.map((m) => h('p', { class: 'status__msg' }, m)));
    preview.show(puzzleSheets(state, puzzle));
  }

  let typingTimer;
  const updateSoon = () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => update(), 250);
  };

  const sizeField = (label, key) => field(label, numberInput({
    value: state[key],
    min: MIN_SIZE,
    max: MAX_SIZE,
    onvalue: (n) => { state[key] = n; update(); },
  }));

  blankPanel.append(
    section('Word bank',
      field('Blank lines', numberInput({
        value: state.blankLines,
        min: 0,
        max: 30,
        onvalue: (n) => { state.blankLines = n; update(); },
      }), 'Lines for writing in words. Use 0 for none.'),
    ),
  );

  const direction = (key, label) => checkbox(label, state.directions[key], (v) => {
    state.directions[key] = v;
    update();
  }, { variant: 'chip' });

  wordsPanel.append(
    section('Words',
      field('Words to hide', h('textarea', {
        rows: 7,
        placeholder: 'photosynthesis\nchlorophyll\nstomata',
        spellcheck: true,
        oninput: (e) => { state.wordsText = e.target.value; updateSoon(); },
      }), wordCount),
    ),
    section('Directions',
      h('div', { class: 'chips' },
        direction('horizontal', 'Across'),
        direction('vertical', 'Down'),
        direction('diagonal', 'Diagonal'),
        direction('backwards', 'Backwards'),
      ),
    ),
    section('Include',
      checkbox('Word bank', state.showWordBank, (v) => { state.showWordBank = v; update(); }),
      checkbox('Answer key page', state.answerKey, (v) => { state.answerKey = v; update(); }),
    ),
  );

  const controls = h('aside', { class: 'controls no-print' },
    h('div', { class: 'controls__body' },
      h('a', { class: 'back-link', href: '#/' }, '← All activities'),
      h('h1', { class: 'controls__title' }, 'Word Search'),
      segmented({
        label: 'Grid type',
        value: state.mode,
        options: [
          { value: 'blank', label: 'Blank template' },
          { value: 'words', label: 'Use my words' },
        ],
        onchange: (v) => { state.mode = v; update(); },
      }),
      section('Page',
        field('Title', h('input', {
          type: 'text',
          value: state.title,
          oninput: (e) => { state.title = e.target.value; update(); },
        })),
        h('div', { class: 'field-row' },
          sizeField('Rows', 'rows'),
          sizeField('Columns', 'cols'),
        ),
        h('div', { class: 'field__hint' }, `Grid size can be ${MIN_SIZE}–${MAX_SIZE} in each direction.`),
      ),
      blankPanel,
      wordsPanel,
    ),
    h('div', { class: 'controls__footer' },
      status,
      h('div', { class: 'controls__actions' },
        shuffleButton,
        button('Print', () => window.print(), { primary: true }),
      ),
    ),
  );

  container.append(h('div', { class: 'workspace' }, controls, preview.el));
  update();
}

export default {
  id: 'word-search',
  name: 'Word Search',
  description: 'A letter grid with hidden words. Start from a blank grid, or enter words to build a puzzle and answer key.',
  render,
};
