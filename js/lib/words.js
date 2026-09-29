// Word-list parsing shared by word-based activities. Pure; unit tested in Node.

export function normalizeWord(word) {
  return word.toLocaleUpperCase().replace(/[^\p{L}]/gu, '');
}

// Split on newlines or commas, drop blanks and duplicates.
// Returns [{ display, letters }] where letters is uppercase with non-letters removed.
export function parseWordList(text) {
  const seen = new Set();
  const words = [];
  for (const raw of text.split(/[\n,]/)) {
    const display = raw.trim();
    const letters = normalizeWord(display);
    if (!letters || seen.has(letters)) continue;
    seen.add(letters);
    words.push({ display, letters });
  }
  return words;
}
