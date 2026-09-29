import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord, parseWordList } from '../js/lib/words.js';

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
