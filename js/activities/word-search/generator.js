// Pure word search logic. No DOM access, so it can be unit tested in Node.

const FILLER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Direction vectors as [rowStep, colStep].
export function directionVectors({ horizontal = true, vertical = true, diagonal = true, backwards = false } = {}) {
  const vectors = [];
  if (horizontal) vectors.push([0, 1]);
  if (vertical) vectors.push([1, 0]);
  if (diagonal) vectors.push([1, 1], [-1, 1]);
  if (backwards) vectors.push(...vectors.map(([dr, dc]) => [-dr, -dc]));
  return vectors;
}

function fits(grid, letters, row, col, dr, dc) {
  const rows = grid.length;
  const cols = grid[0].length;
  const endRow = row + dr * (letters.length - 1);
  const endCol = col + dc * (letters.length - 1);
  if (endRow < 0 || endRow >= rows || endCol < 0 || endCol >= cols) return false;
  for (let i = 0; i < letters.length; i++) {
    const existing = grid[row + dr * i][col + dc * i];
    if (existing !== null && existing !== letters[i]) return false;
  }
  return true;
}

// Places words (longest first) at a random valid spot each, then fills the rest.
// Returns { grid, placements, unplaced }. `rng` is injectable for tests.
export function generatePuzzle({ rows, cols, words, directions, rng = Math.random }) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const vectors = directionVectors(directions);
  const placements = [];
  const unplaced = [];
  const pick = (list) => list[Math.floor(rng() * list.length)];

  const sorted = [...words].sort((a, b) => b.letters.length - a.letters.length);
  for (const word of sorted) {
    const letters = [...word.letters];
    const candidates = [];
    for (const [dr, dc] of vectors) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (fits(grid, letters, row, col, dr, dc)) candidates.push({ row, col, dr, dc });
        }
      }
    }
    if (candidates.length === 0) {
      unplaced.push(word);
      continue;
    }
    const spot = pick(candidates);
    letters.forEach((letter, i) => {
      grid[spot.row + spot.dr * i][spot.col + spot.dc * i] = letter;
    });
    placements.push({ ...word, ...spot, length: letters.length });
  }

  const filled = grid.map((line) => line.map((cell) => cell ?? pick(FILLER_LETTERS)));
  // Keep placements in the order the user entered them.
  const order = new Map(words.map((w, i) => [w.letters, i]));
  placements.sort((a, b) => order.get(a.letters) - order.get(b.letters));
  return { grid: filled, placements, unplaced };
}

// Set of "row,col" keys covered by placed words, for the answer key.
export function answerCells(placements) {
  const cells = new Set();
  for (const { row, col, dr, dc, length } of placements) {
    for (let i = 0; i < length; i++) cells.add(`${row + dr * i},${col + dc * i}`);
  }
  return cells;
}
