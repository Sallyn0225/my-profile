# AGENTS.md

This repo is a **static** Linktree-style profile page (plain **HTML/CSS/vanilla JS**) meant to be deployed to **Cloudflare Pages**.

## Repo shape

```text
.
├── index.html     # Page markup + content + SEO meta
├── styles.css     # Theme tokens, layout, animations, responsive rules
├── script.js      # UI interactions (animations/parallax/stars/meteors)
├── game.js        # Flappy Kaho game logic (canvas render/audio/theme)
├── i18n.js        # i18n loader + DOM translation
├── locales/       # JSON translation files (zh/en/ja)
├── avatar.jpg     # Avatar image referenced by index.html
└── kaho-origin_pixel_art.png # Game character pixel art
```

## Build / lint / test

There is **no** Node/Python build system here:

- No `package.json` / `pnpm-lock.yaml` / `yarn.lock`
- No ESLint/Prettier config
- No test runner, and no `__tests__` / `*test*` files

### Local preview (recommended)

Run a simple HTTP server from the repo root:

```bash
python -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

Why: don’t use `file://` — relative resources (e.g., `locales/*.json`, `avatar.jpg`) behave differently.

### Lint / formatting

No automated lint/format commands are configured.
If you want to add tooling (Prettier/ESLint/stylelint), **ask first**; keep the repo lightweight.

### Tests

No tests are configured.

**Running a single test:** N/A (no test framework).

### “Quality bar” checks before shipping

Since there’s no CI here, verify manually:

1. Start the local server (`python -m http.server 4173`).
2. Load the page and click every link.
3. Test language switching behavior (see i18n notes below).
4. Check both light/dark mode.
5. Check `prefers-reduced-motion` behavior (animations should reduce/stop).

## Code style & conventions (follow existing code)

There are no formal style configs; follow the patterns already used in:
`index.html`, `styles.css`, `script.js`, `i18n.js`.

### General principles

- Keep this repo dependency-free (no bundlers) unless explicitly requested.
- Avoid refactors unrelated to the requested change.
- Prefer small, readable functions over clever abstractions.

### HTML (`index.html`)

- Indentation: **4 spaces**.
- Semantic structure: `header`, `main`, `section`, `footer`.
- External links: use `target="_blank"` + `rel="noopener noreferrer"`.
- i18n hooks:
  - Use `data-i18n="some.key"` for text nodes.
  - Use `data-i18n-attr="attr:key.path"` for attributes (example in avatar `alt`).
- Keep SEO meta tags consistent with i18n updates (see `i18n.js:updateMeta`).

### CSS (`styles.css`)

- Indentation: **4 spaces**.
- Prefer CSS custom properties (design tokens) in `:root`.
- Dark mode uses:
  - `@media (prefers-color-scheme: dark)` with token overrides.
- Motion/accessibility:
  - Respect `@media (prefers-reduced-motion: reduce)` and avoid introducing new always-on animations.
- Responsive patterns:
  - Use media queries and fluid sizing (`clamp(...)`) to avoid breakpoint jumps.
- Keep effect layers behind content via `z-index` and `pointer-events: none`.

### JavaScript (`script.js`, `i18n.js`)

- Pattern: wrap code in an **IIFE** and keep `'use strict';` at the top.
- Indentation: **2 spaces**.
- Semicolons: used.
- Naming:
  - `camelCase` for variables/functions (`initParallaxEffect`, `prefersReducedMotion`).
  - `UPPER_SNAKE_CASE` for constants (`MAX_STARS`).
  - CSS/HTML classes remain `kebab-case`.
- Comments/JSDoc:
  - `i18n.js` uses JSDoc-style comments for functions and async behavior.
  - Keep comments focused on intent and edge cases.

### Error handling & logging

- Async operations (fetching locales) use `try/catch` and fallback logic (`i18n.js`).
- Prefer:
  - `console.warn(...)` for missing optional DOM elements / non-fatal issues.
  - `console.error(...)` for unexpected failures.
- Do not silently swallow errors.

### DOM & performance

- Avoid global pollution; keep state inside the IIFE.
- Use `requestAnimationFrame` for animation loops; avoid heavy work per frame.
- When adding event listeners, consider cleanup/visibility:
  - Existing code pauses work on `visibilitychange`.

### Accessibility

- Preserve `prefers-reduced-motion` behavior.
- Keep touch targets >= 44px (existing CSS uses 56px for link cards).
- Keep `alt` text present and translatable.

## i18n / locales

- Locales live in `locales/{lang}.json` and are fetched at runtime.
- Supported language codes are currently: `zh`, `en`, `ja` (see `detectLanguage()`).
- Adding a locale:
  1. Add `locales/<new>.json`.
  2. Update the supported list in `i18n.js`.
  3. Ensure keys exist for all `data-i18n`/meta keys used.

## Cloudflare Pages deployment

Per README:

- Framework preset: **None**
- Build command: *(empty)*
- Output directory: `.`

## Cursor / Copilot instructions

No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found in this repo.
