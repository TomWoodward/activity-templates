# CLAUDE.md

Printable classroom activity templates (currently: Word Search, Crossword). A static single-page app, deployed to GitHub Pages. See README.md for the file layout, run commands, and the basic "add an activity" steps.

The primary output is **paper**. The on-screen view is a preview of printed pages plus a control panel. Judge every change by how it prints first, then how the preview looks on desktop and on phones.

## Hard constraints

- **No build step, no dependencies.** Plain ES modules loaded by the browser. Don't add npm packages, bundlers, TypeScript, or frameworks without asking. `package.json` exists only for `npm start` / `npm test`.
- **All paths are relative** (`css/app.css`, `js/main.js`, `#/<id>` links). The site is served from a project subpath (`user.github.io/<repo>/`), so a leading `/` breaks the deploy.
- **Hash routing only** (`#/word-search`). GitHub Pages has no SPA fallback, so don't switch to History API routes.
- **Deploy copies only `index.html`, `css/`, `js/`** (see `.github/workflows/deploy.yml`). Any new top-level runtime folder (e.g. `fonts/`, `img/`) must also be added to the `cp` line there.
- Node 22+ (needed for the `node --test "tests/**/*.test.js"` glob).

## Architecture

- `js/main.js`: the router. It clears `#app` and calls `activity.render(app)` on every hash change. Activities own their state inside `render()`. There is no global store and no persistence (a refresh resets everything).
- `js/activities/registry.js`: the list of activities. Each module default-exports `{ id, name, description, render(container) }`. The `id` is the URL hash.
- `js/dom.js`: `h(tag, attrs, ...children)` builds elements. `on*` function attrs become listeners. `style` objects support CSS custom properties (`'--cell': '0.4in'`). Use `svg()` for SVG elements.
- `js/lib/`: pure helpers shared across activities. `words.js` has `parseWordList(text)`, which returns `[{ display, letters }]` (newline/comma separated, de-duplicated, `letters` uppercased with non-letters stripped).
- `js/components/`: shared building blocks. Reuse these, and extend them rather than forking per activity:
  - `sheet.js`: `sheet(...)` is one printed page. `sheetHeader({ title, fields })` makes a title plus optional fill-in blanks (`fields: []` for answer keys and extra pages). `studentHeader(state)` is the student page header, with Name/Date if `state.showNameDate`. `sheetHeaderHeight(state)` is the height to reserve for it. It also owns page geometry. Margins are always an object `{ top, right, bottom, left }` in inches: `printableArea(margins)`, `setPageMargins(margins)`, `DEFAULT_MARGINS`, `MARGIN_RANGE`. `defaultPageSettings()` gives `{ margins, showNameDate }` to spread into an activity's state.
  - `workspace.js`: `activityWorkspace({ title, controls, status, actions, preview })` builds the standard page (always appends a Print button after `actions`). `createStatus()` returns `{ el, show(...messages) }`; falsy messages are skipped.
  - `preview.js`: `createPreview()` returns `{ el, show(pages) }`, with `pages` as `[{ label, sheet }]`. It scales sheets to fit the column using `zoom: var(--preview-scale)`, which print resets to 1.
  - `form.js`: `section`, `field`, `numberInput` (updates live while typing, clamps and snaps to `step` on blur), `checkbox` (`variant: 'chip'` for toggle buttons), `segmented`, `disclosure` (collapsible "Advanced" group), `marginFields(margins, onchange)` (the four margin inputs, which mutate `margins` in place), `advancedSettings(state, onchange, ...extra)` (the standard Advanced group: margins, Name/Date toggle, and any extra controls), `button`. `field()` auto-assigns id/name so labels work.
- Activity page structure, built by `activityWorkspace()`:
  ```
  .workspace
    aside.controls.no-print
      .controls__body     scrolling settings, grouped with section()
      .controls__footer   status messages + .controls__actions (Print etc.), always visible
    preview.el
  ```
  On phones (`screen and (max-width: 860px)`) the footer becomes a bar fixed to the bottom of the screen.
- **Activity module pattern** (see `crossword/index.js` for the leanest example): `defaultState()` spreads `defaultPageSettings()`. `render()` builds controls once, then a single `update()` does the following on every change: `setPageMargins()`, regenerate content only if its inputs changed (compare a JSON key), build status messages, and `preview.show(pages(state, ...))`. Controls end with `advancedSettings(state, update)`. Debounce textarea input (~250ms).
- **Don't rebuild controls inside `update()`** while the user may be typing in them, or focus is lost on every keystroke. Crossword's clue boxes are rebuilt only when the layout is regenerated. Key user-entered data by something stable (crossword clues are keyed by the word's letters, not its number, so they survive Shuffle).
- Keep puzzle and content logic **pure and DOM-free** in its own module (like `word-search/generator.js` and `crossword/generator.js`) so it can be unit tested in Node. Inject randomness (`rng`; tests use `seeded()` from `tests/helpers.js`) so tests can be deterministic.
- Crossword layout is greedy and tries several random word orders (see the header comment in `crossword/generator.js`). Its key invariant, enforced by a test, is that every run of 2+ letters in the grid is exactly one entry: no words touching side-by-side, and no accidental words.

## Print layout rules (learned the hard way)

- Page is US Letter. **Margins are a user setting**, per side (Advanced → Page margins, 0.25–1.5in each, default 0.5in), because changing margins in the browser's print dialog overflows layouts sized for a fixed area. An activity keeps `margins: { ...DEFAULT_MARGINS }` in its state, renders `marginFields()` inside its Advanced `disclosure()`, and calls `setPageMargins(state.margins)` on every update. That rewrites a runtime `<style>` with `@page { margin }` for print and `--page-margin-{top,right,bottom,left}` for the on-screen `.sheet` padding. The router resets it to the defaults on every route change.
- Size content against `printableArea(margins)` (default 7.5in × 10in), never hard-coded page dimensions. When shrinking content to fit makes it unusable, warn in the status area rather than overflowing or silently printing something unreadable (word search warns below 0.25in grid squares). Or move secondary content to its own page: crossword puts clues on a separate page when sharing would push squares below 0.3in. In print, `.sheet` padding is removed and the `@page` margin takes over.
- Size printed content in **physical units (in/pt)**, never px or viewport units. Activities do their own fit-to-page math (see `cellSize()` / `wordBankHeight()` in `word-search/index.js`). If you add content to a page, reserve height for it or the page will overflow onto a second sheet.
- **Media queries for screen-only layout must say `screen and`.** A printed Letter page is ~720px wide, so a bare `@media (max-width: 860px)` also applies in print and breaks pagination.
- **Don't use CSS multi-column (`column-count`) on sheets.** Chrome splits the columns across printed pages. Use CSS grid instead (the word bank uses `grid-auto-flow: column` with `--bank-rows`).
- **Irregular grids: draw lines as one SVG, not CSS borders.** CSS borders sit inside each cell's box, so a cell's left border and its neighbor's right border land 1px apart. Borders on only some cells therefore misalign, and full borders on every cell double up into thick lines. Crossword computes line runs with `gridLines(grid)` (unit tested) and draws one `<path>` in CSS px coordinates (no `viewBox`, so `stroke-width` is a real length). On screen the preview's `zoom` would make a 1px line thinner than a pixel: blurry in Chrome, and missing entirely in Firefox with `crispEdges`. So a `@media screen` rule sets `stroke-width: calc(1px / var(--preview-scale))` and adds `crispEdges`. Keep stroke widths as lengths: Firefox rejected unitless `calc()` for `stroke-width` and fell back to width 1, which in cell-unit coordinates filled whole cells. Print uses the plain width with no snapping. Don't use `vector-effect: non-scaling-stroke`. Test SVG changes in Firefox too, at phone width (`firefox --headless` supports WebDriver BiDi on `--remote-debugging-port`). A full rectangular grid (word search's lined grid) is fine with right/bottom borders on every cell plus top/left on the frame.
- **Backgrounds don't print by default.** Use SVG strokes, borders, or text color for anything that must show on paper (answer-key highlights are SVG `<line>`s behind the letters).
- Each `.preview__page` gets `break-after: page`. Add pages through `preview.show()` and don't insert your own page breaks.
- Anything that shouldn't print gets the `no-print` class.

## Verifying changes

1. `npm test`. Add tests in `tests/<activity>.test.js` for any new pure logic.
2. `npm start`, then check in a browser (the Chrome DevTools MCP works well). Check **desktop around 1100px wide** (the width where the preview first has to shrink) and a **390px phone**. Confirm there's no horizontal page scroll: `document.documentElement.scrollWidth === innerWidth`.
3. **Check real print output**, not just the screen. The DevTools MCP can't print, so use headless Chrome:
   ```sh
   google-chrome --headless=new --no-pdf-header-footer --print-to-pdf=out.pdf "http://localhost:8080/#/word-search"
   ```
   That only captures the default state. For states that need form input, drive Chrome over the DevTools Protocol (`--remote-debugging-port`, then `Runtime.evaluate` to fill controls and `Page.printToPDF`). Node 22's built-in `WebSocket` is enough; no puppeteer needed. Check the page count and look at the PDF, especially at maximum sizes (30×30 grid, 30 words).
4. Check the console for errors and a11y issues (form fields need labels, ids, and names).
