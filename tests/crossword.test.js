import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCrossword, gridLines } from '../js/activities/crossword/generator.js';
import { parseWordList } from '../js/lib/words.js';
import { seeded } from './helpers.js';

const BIOLOGY = parseWordList(
  'photosynthesis\nchlorophyll\nstomata\nxylem\nphloem\nroot\nleaf\nsunlight\nwater\ncarbon dioxide\nglucose\noxygen\nnucleus\nmitosis\nenzyme',
);

function readEntry(grid, { row, col, direction, length }) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += direction === 'across' ? grid[row][col + i] : grid[row + i][col];
  }
  return out;
}

// Every maximal run of 2+ letters, as "direction:row,col:WORD".
function letterRuns(grid) {
  const runs = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const scan = (direction, outer, inner, at) => {
    for (let a = 0; a < outer; a++) {
      let start = null;
      let word = '';
      for (let b = 0; b <= inner; b++) {
        const letter = b < inner ? at(a, b) : null;
        if (letter) {
          if (start === null) start = b;
          word += letter;
        } else {
          if (word.length >= 2) {
            const [r, c] = direction === 'across' ? [a, start] : [start, a];
            runs.push(`${direction}:${r},${c}:${word}`);
          }
          start = null;
          word = '';
        }
      }
    }
  };
  scan('across', rows, cols, (r, c) => grid[r][c]);
  scan('down', cols, rows, (c, r) => grid[r][c]);
  return runs.sort();
}

test('every placed entry reads correctly in the grid', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { grid, entries } = generateCrossword({ words: BIOLOGY, rng: seeded(seed) });
    for (const e of entries) assert.equal(readEntry(grid, e), e.letters);
  }
});

test('grid contains no accidental words: every run of letters is exactly one entry', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { grid, entries } = generateCrossword({ words: BIOLOGY, rng: seeded(seed) });
    const expected = entries.map((e) => `${e.direction}:${e.row},${e.col}:${e.letters}`).sort();
    assert.deepEqual(letterRuns(grid), expected, `seed ${seed}`);
  }
});

test('all entries are connected into one puzzle', () => {
  const { grid, entries } = generateCrossword({ words: BIOLOGY, rng: seeded(5) });
  const start = [entries[0].row, entries[0].col];
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length) {
    const [r, c] = queue.pop();
    for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
      if (grid[nr]?.[nc] && !seen.has(`${nr},${nc}`)) {
        seen.add(`${nr},${nc}`);
        queue.push([nr, nc]);
      }
    }
  }
  const letterCount = grid.flat().filter(Boolean).length;
  assert.equal(seen.size, letterCount);
});

test('places most words from a typical list', () => {
  const { entries, unplaced } = generateCrossword({ words: BIOLOGY, rng: seeded(9) });
  assert.ok(entries.length >= BIOLOGY.length - 1, `placed ${entries.length} of ${BIOLOGY.length}`);
  assert.equal(entries.length + unplaced.length, BIOLOGY.length);
});

test('numbers entries in reading order, sharing a number when across and down start together', () => {
  const { entries } = generateCrossword({ words: BIOLOGY, rng: seeded(2) });
  const starts = new Map();
  for (const e of entries) {
    const k = `${e.row},${e.col}`;
    if (starts.has(k)) assert.equal(starts.get(k), e.number);
    starts.set(k, e.number);
  }
  const ordered = [...starts.entries()]
    .map(([k, n]) => [...k.split(',').map(Number), n])
    .sort(([r1, c1], [r2, c2]) => r1 - r2 || c1 - c2);
  ordered.forEach(([, , n], i) => assert.equal(n, i + 1));
});

test('reports words that share no letters with the rest', () => {
  const words = parseWordList('banana\nbandana\nxyz');
  const { entries, unplaced } = generateCrossword({ words, rng: seeded(1) });
  assert.deepEqual(entries.map((e) => e.letters).sort(), ['BANANA', 'BANDANA']);
  assert.deepEqual(unplaced.map((w) => w.letters), ['XYZ']);
});

test('rejects single letters and words longer than the max size', () => {
  const words = parseWordList('a\ncat\nextraordinarily');
  const { entries, unplaced } = generateCrossword({ words, maxSize: 10, rng: seeded(1) });
  assert.deepEqual(entries.map((e) => e.letters), ['CAT']);
  assert.deepEqual(unplaced.map((w) => w.letters), ['A', 'EXTRAORDINARILY']);
});

test('keeps the layout within maxSize', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { rows, cols } = generateCrossword({ words: BIOLOGY, maxSize: 15, rng: seeded(seed) });
    assert.ok(rows <= 15 && cols <= 15, `${rows}x${cols}`);
  }
});

test('handles an empty word list', () => {
  const result = generateCrossword({ words: [] });
  assert.deepEqual(result, { rows: 0, cols: 0, grid: [], entries: [], unplaced: [] });
});

test('gridLines outlines letter cells with merged, non-overlapping runs', () => {
  // A plus shape:  .A.
  //                BCD
  //                .E.
  const grid = [[null, 'A', null], ['B', 'C', 'D'], [null, 'E', null]];
  const { horizontal, vertical } = gridLines(grid);
  assert.deepEqual(horizontal, [
    { y: 0, x1: 1, x2: 2 },
    { y: 1, x1: 0, x2: 3 },
    { y: 2, x1: 0, x2: 3 },
    { y: 3, x1: 1, x2: 2 },
  ]);
  assert.deepEqual(vertical, [
    { x: 0, y1: 1, y2: 2 },
    { x: 1, y1: 0, y2: 3 },
    { x: 2, y1: 0, y2: 3 },
    { x: 3, y1: 1, y2: 2 },
  ]);
});

test('gridLines draws every letter cell edge exactly once', () => {
  const { grid } = generateCrossword({ words: BIOLOGY, rng: seeded(4) });
  const { horizontal, vertical } = gridLines(grid);
  const seen = new Map();
  const mark = (k) => seen.set(k, (seen.get(k) ?? 0) + 1);
  for (const { y, x1, x2 } of horizontal) for (let x = x1; x < x2; x++) mark(`h${y},${x}`);
  for (const { x, y1, y2 } of vertical) for (let y = y1; y < y2; y++) mark(`v${x},${y}`);
  assert.ok([...seen.values()].every((n) => n === 1));
  grid.forEach((row, r) => row.forEach((letter, c) => {
    if (!letter) return;
    for (const k of [`h${r},${c}`, `h${r + 1},${c}`, `v${c},${r}`, `v${c + 1},${r}`]) assert.ok(seen.has(k), k);
  }));
});
