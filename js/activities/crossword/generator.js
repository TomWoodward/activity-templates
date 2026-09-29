// Pure crossword layout logic. No DOM access, so it can be unit tested in Node.
//
// Greedy placement: the first word goes across, then each remaining word is
// placed where it crosses the most existing letters without touching any other
// word side-by-side. Several random word orders are tried and the best layout
// (most words placed, then smallest area) wins.

const STEP = { across: [0, 1], down: [1, 0] };
const key = (r, c) => `${r},${c}`;

function createBoard() {
  const cells = new Map(); // "r,c" -> { letter, across: bool, down: bool }
  const bounds = { minR: 0, maxR: -1, minC: 0, maxC: -1 };
  return { cells, bounds, placed: [] };
}

function occupied(board, r, c) {
  return board.cells.has(key(r, c));
}

// Returns the number of crossings if the word fits at (row, col, dir), else -1.
function crossingsAt(board, letters, row, col, dir) {
  const [dr, dc] = STEP[dir];
  const len = letters.length;
  if (occupied(board, row - dr, col - dc) || occupied(board, row + dr * len, col + dc * len)) return -1;

  let crossings = 0;
  for (let i = 0; i < len; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const cell = board.cells.get(key(r, c));
    if (cell) {
      if (cell.letter !== letters[i] || cell[dir]) return -1;
      crossings++;
    } else if (occupied(board, r + dc, c + dr) || occupied(board, r - dc, c - dr)) {
      // An empty cell of the new word must not sit beside another word's letter.
      return -1;
    }
  }
  return crossings;
}

function boundsWith(bounds, row, col, dir, len) {
  const [dr, dc] = STEP[dir];
  const empty = bounds.maxR < bounds.minR;
  return {
    minR: empty ? row : Math.min(bounds.minR, row),
    minC: empty ? col : Math.min(bounds.minC, col),
    maxR: empty ? row + dr * (len - 1) : Math.max(bounds.maxR, row + dr * (len - 1)),
    maxC: empty ? col + dc * (len - 1) : Math.max(bounds.maxC, col + dc * (len - 1)),
  };
}

const sizeOf = (b) => ({ rows: b.maxR - b.minR + 1, cols: b.maxC - b.minC + 1 });

function place(board, word, row, col, dir) {
  const [dr, dc] = STEP[dir];
  const letters = [...word.letters];
  letters.forEach((letter, i) => {
    const k = key(row + dr * i, col + dc * i);
    const cell = board.cells.get(k) ?? { letter, across: false, down: false };
    cell[dir] = true;
    board.cells.set(k, cell);
  });
  board.bounds = boundsWith(board.bounds, row, col, dir, letters.length);
  board.placed.push({ ...word, row, col, direction: dir, length: letters.length });
}

// Best spot for a word that crosses the current board, or null.
function bestPlacement(board, word, maxSize, rng) {
  const letters = [...word.letters];
  let best = null;
  for (const [k, cell] of board.cells) {
    const [r, c] = k.split(',').map(Number);
    for (let i = 0; i < letters.length; i++) {
      if (letters[i] !== cell.letter) continue;
      const dir = cell.across ? 'down' : 'across';
      if (cell[dir]) continue;
      const [dr, dc] = STEP[dir];
      const row = r - dr * i;
      const col = c - dc * i;
      const crossings = crossingsAt(board, letters, row, col, dir);
      if (crossings < 1) continue;
      const size = sizeOf(boundsWith(board.bounds, row, col, dir, letters.length));
      if (size.rows > maxSize || size.cols > maxSize) continue;
      // Prefer more crossings, then a squarer and smaller layout; random tie-break.
      const score = crossings * 1000 - size.rows * size.cols - Math.abs(size.rows - size.cols) * 2 + rng();
      if (!best || score > best.score) best = { row, col, dir, score };
    }
  }
  return best;
}

function attempt(words, maxSize, rng) {
  const board = createBoard();
  const [first, ...rest] = words;
  if (first.letters.length > maxSize) return { board, unplaced: words };
  place(board, first, 0, 0, rng() < 0.5 ? 'across' : 'down');

  // Keep sweeping: a word that can't cross yet may fit after others are placed.
  let pending = rest;
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    const stillPending = [];
    for (const word of pending) {
      const spot = bestPlacement(board, word, maxSize, rng);
      if (spot) {
        place(board, word, spot.row, spot.col, spot.dir);
        progress = true;
      } else {
        stillPending.push(word);
      }
    }
    pending = stillPending;
  }
  return { board, unplaced: pending };
}

function crossingCount(board) {
  let n = 0;
  for (const cell of board.cells.values()) if (cell.across && cell.down) n++;
  return n;
}

// Shifts the layout to start at (0,0) and numbers entries in reading order.
function finalize(board, unplaced) {
  const { minR, minC } = board.bounds;
  const { rows, cols } = sizeOf(board.bounds);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const [k, cell] of board.cells) {
    const [r, c] = k.split(',').map(Number);
    grid[r - minR][c - minC] = cell.letter;
  }

  const entries = board.placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  const starts = [...new Set(entries.map((e) => key(e.row, e.col)))]
    .map((k) => k.split(',').map(Number))
    .sort(([r1, c1], [r2, c2]) => r1 - r2 || c1 - c2);
  const numberAt = new Map(starts.map(([r, c], i) => [key(r, c), i + 1]));
  for (const e of entries) e.number = numberAt.get(key(e.row, e.col));
  entries.sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1));

  return { rows, cols, grid, entries, unplaced };
}

// words: [{ display, letters }]. Returns
// { rows, cols, grid (letter|null)[][], entries: [{ number, direction, row, col, length, display, letters }], unplaced }.
export function generateCrossword({ words, maxSize = 25, attempts = 40, rng = Math.random }) {
  const usable = words.filter((w) => w.letters.length >= 2 && w.letters.length <= maxSize);
  const rejected = words.filter((w) => !usable.includes(w));
  if (usable.length === 0) return { rows: 0, cols: 0, grid: [], entries: [], unplaced: rejected };

  let best = null;
  for (let i = 0; i < attempts; i++) {
    // Longest words first, loosely: jitter shuffles words of similar length.
    const order = usable
      .map((w) => ({ w, sortKey: w.letters.length + (i === 0 ? 0 : rng() * 4) }))
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ w }) => w);
    const result = attempt(order, maxSize, rng);
    const { rows, cols } = sizeOf(result.board.bounds);
    const score = result.board.placed.length * 1e6 + crossingCount(result.board) * 1e3 - rows * cols;
    if (!best || score > best.score) best = { ...result, score };
  }

  // Report unplaced words in the order they were entered.
  const unplacedSet = new Set([...best.unplaced, ...rejected]);
  return finalize(best.board, words.filter((w) => unplacedSet.has(w)));
}

// Grid lines to draw around letter cells, merged into continuous runs so each
// line is drawn once. Coordinates are in cell units along cell boundaries:
// horizontal lines are { y, x1, x2 }, vertical lines are { x, y1, y2 }.
export function gridLines(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const filled = (r, c) => Boolean(grid[r]?.[c]);
  const horizontal = [];
  const vertical = [];

  // A boundary is drawn if a letter cell is on either side of it.
  const runs = (count, length, isEdge, push) => {
    for (let i = 0; i <= count; i++) {
      let start = null;
      for (let j = 0; j <= length; j++) {
        const edge = j < length && isEdge(i, j);
        if (edge && start === null) start = j;
        if (!edge && start !== null) {
          push(i, start, j);
          start = null;
        }
      }
    }
  };
  runs(rows, cols, (y, x) => filled(y - 1, x) || filled(y, x), (y, x1, x2) => horizontal.push({ y, x1, x2 }));
  runs(cols, rows, (x, y) => filled(y, x - 1) || filled(y, x), (x, y1, y2) => vertical.push({ x, y1, y2 }));
  return { horizontal, vertical };
}
