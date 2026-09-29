// Each activity module exports: { id, name, description, render(container) }.
// To add a new activity type, create js/activities/<id>/index.js and list it here.
import wordSearch from './word-search/index.js';
import crossword from './crossword/index.js';

export const activities = [wordSearch, crossword];

export function getActivity(id) {
  return activities.find((activity) => activity.id === id) ?? null;
}
