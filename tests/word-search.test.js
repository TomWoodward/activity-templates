import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWord,
  parseWordList,
  directionVectors,
  generatePuzzle,
  answerCells,
} from '../js/activities/word-search/generator.js';

// Deterministic RNG so failures are reproducible.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_DIRECTIONS = { horizontal: true, vertical: true, diagonal: true, backwards: true };

function readPlacement(grid, { row, col, dr, dc, length }) {
  let out = '';
  for (let i = 0; i < length; i++) out += grid[row + dr * i][col + dc * i];
  return out;
}

test('normalizeWord uppercases and strips non-letters', () => {
  assert.equal(normalizeWord("ice cream"), 'ICECREAM');
  assert.equal(normalizeWord("rock-n-roll!"), 'ROCKNROLL');
  assert.equal(normalizeWord('123'), '');
});

test('parseWordList splits on newlines and commas, drops blanks and duplicates', () => {
  const words = parseWordList('apple, Banana\n\n  apple \ncherry pie,,');
  assert.deepEqual(words.map((w) => w.letters), ['APPLE', 'BANANA', 'CHERRYPIE']);
  assert.equal(words[2].display, 'cherry pie');
});

test('directionVectors respects toggles', () => {
  assert.equal(directionVectors({ horizontal: true, vertical: false, diagonal: false }).length, 1);
  assert.equal(directionVectors(ALL_DIRECTIONS).length, 8);
  assert.equal(directionVectors({ horizontal: false, vertical: false, diagonal: false, backwards: true }).length, 0);
});

test('generatePuzzle places every word so it reads correctly in the grid', () => {
  const words = parseWordList('photosynthesis\nchlorophyll\nstomata\nxylem\nphloem\nroot\nleaf');
  for (let seed = 1; seed <= 25; seed++) {
    const { grid, placements, unplaced } = generatePuzzle({
      rows: 15, cols: 15, words, directions: ALL_DIRECTIONS, rng: seeded(seed),
    });
    assert.equal(unplaced.length, 0);
    assert.equal(placements.length, words.length);
    for (const p of placements) assert.equal(readPlacement(grid, p), p.letters);
  }
});

test('generatePuzzle fills every cell with a letter', () => {
  const { grid } = generatePuzzle({
    rows: 8, cols: 12, words: parseWordList('cat'), directions: ALL_DIRECTIONS, rng: seeded(7),
  });
  assert.equal(grid.length, 8);
  for (const row of grid) {
    assert.equal(row.length, 12);
    for (const cell of row) assert.match(cell, /^\p{L}$/u);
  }
});

test('generatePuzzle keeps placements in the order words were entered', () => {
  const words = parseWordList('ox\nelephant\ncat');
  const { placements } = generatePuzzle({
    rows: 10, cols: 10, words, directions: ALL_DIRECTIONS, rng: seeded(3),
  });
  assert.deepEqual(placements.map((p) => p.letters), ['OX', 'ELEPHANT', 'CAT']);
});

test('generatePuzzle reports words that cannot fit', () => {
  const { placements, unplaced } = generatePuzzle({
    rows: 5, cols: 5, words: parseWordList('toolongword\nfit'), directions: ALL_DIRECTIONS, rng: seeded(1),
  });
  assert.deepEqual(unplaced.map((w) => w.letters), ['TOOLONGWORD']);
  assert.deepEqual(placements.map((p) => p.letters), ['FIT']);
});

test('generatePuzzle only uses enabled directions', () => {
  const { placements } = generatePuzzle({
    rows: 10, cols: 10,
    words: parseWordList('alpha\nbeta\ngamma\ndelta'),
    directions: { horizontal: true, vertical: false, diagonal: false, backwards: false },
    rng: seeded(11),
  });
  for (const p of placements) assert.deepEqual([p.dr, p.dc], [0, 1]);
});

test('answerCells covers every letter of every placement', () => {
  const cells = answerCells([
    { row: 0, col: 0, dr: 0, dc: 1, length: 3 },
    { row: 2, col: 2, dr: -1, dc: -1, length: 2 },
  ]);
  assert.deepEqual([...cells].sort(), ['0,0', '0,1', '0,2', '1,1', '2,2']);
});
