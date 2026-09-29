# Activity Templates

Printable classroom activity templates, built as a small single-page app with no build step or dependencies.

Current activities:

- **Word Search**: a blank grid at any size (5–30 × 5–30) with a blank word bank, or a puzzle generated from your own words with an optional answer key.
- **Crossword**: a numbered grid built from your answer words, with an optional answer key. Type the clues in, or print numbered blank lines to write them by hand. Empty typed clues also print as blank lines.

## Run locally

Requires Node 22+.

```sh
npm start        # http://localhost:8080  (set PORT to change)
npm test         # unit tests for the puzzle generators
```

Any static file server also works (for example, `python3 -m http.server`). Opening `index.html` directly from disk won't work, because browsers block ES modules on `file://` URLs.

## Printing

Every page is laid out for US Letter. Margins default to 0.5in and can be set per side under **Advanced** in the settings. Set them there rather than in the print dialog, since the layout is sized to fit the margins you choose. Use the **Print** button, or your browser's print command. The controls are hidden in print, and the answer key prints on its own page.

## Deploying

`.github/workflows/deploy.yml` runs the tests, then publishes `index.html`, `css/` and `js/` to GitHub Pages on every push to `main`. One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

Routing uses the URL hash (`#/word-search`), so the app works under a project subpath without any 404 redirect workaround.

## Project layout

```
index.html
css/app.css                          screen + print styles
js/main.js                           hash router and the activity index page
js/dom.js                            tiny element-builder helpers
js/components/sheet.js               shared printable page + Name/Date header
js/components/preview.js             on-screen page stack, scaled to fit the screen
js/components/form.js                shared control-panel inputs
js/components/workspace.js           shared activity page layout + status area
js/lib/words.js                      word-list parsing shared by activities
js/activities/registry.js            list of activity types
js/activities/word-search/
  index.js                           controls + printable sheets
  generator.js                       pure puzzle logic (unit tested)
js/activities/crossword/
  index.js                           controls + printable sheets
  generator.js                       pure crossword layout (unit tested)
tests/                               node:test suites
scripts/serve.js                     local static server
```

## Adding an activity type

1. Create `js/activities/<id>/index.js` that default-exports `{ id, name, description, render(container) }`.
2. Build the page with `activityWorkspace()` from `js/components/workspace.js`, the controls from `js/components/form.js` (ending with `advancedSettings()`), and printable pages with `sheet()` / `studentHeader()` from `js/components/sheet.js`, shown via `createPreview()`. `js/activities/crossword/index.js` is a good template to copy. Anything with the `no-print` class is hidden when printing.
3. Add it to the array in `js/activities/registry.js`. It then shows up on the index page at `#/<id>`.
