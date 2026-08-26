# CLAUDE.md

Guidance for working in the **Buy Risk** codebase.

## Project purpose

Buy Risk is an **investing-education website**. Its thesis is in the name:
every real investment return is compensation for bearing risk. The site
teaches the core, evidence-based ideas of investing — risk and return,
compounding, diversification, fees, and inflation — in **plain language**,
paired with **interactive tools** that let readers manipulate the variables
themselves.

Audience: curious beginners, not finance professionals. Tone is
academic-but-friendly: precise and evidence-based, but jargon is always
defined before it's used. All content is **educational only and never
personalized financial advice** — keep that framing intact.

## Tech stack

- **[Astro](https://astro.build) 5** — static site, file-based routing, islands
  architecture. Ships zero JS by default.
- **TypeScript** in `strict` mode (extends `astro/tsconfigs/strict`).
- **React 19** via `@astrojs/react` — only for interactive components
  ("islands"), hydrated explicitly (e.g. `client:load`).
- **Markdown** blog via Astro **content collections** (`astro:content`), with
  frontmatter validated by **Zod**.
- **Shiki** for code highlighting (dual light/dark themes).
- Plain **CSS** with custom properties — no CSS framework. No component library.

## Project structure

```
src/
  components/      Reusable UI. .astro = static; .tsx = React island.
  content/blog/    Markdown blog posts (one file per post).
  content.config.ts  Blog collection schema (Zod).
  layouts/         BaseLayout (shell) and BlogPost (article layout).
  pages/           File-based routes.
    index.astro      Homepage
    about.astro      About page
    blog/            Blog index + [...slug].astro dynamic post route
    tools/           Interactive simulators
  styles/global.css  Design system: tokens, theming, base elements, utilities.
public/            Static assets served as-is (favicon, etc.).
```

## Commands

```bash
npm run dev      # start dev server (http://localhost:4321)
npm run build    # astro check (typecheck) + production build to dist/
npm run preview  # serve the production build locally
```

`npm run build` runs `astro check` first, so a type error fails the build.

## Conventions

### Components

- Prefer `.astro` components — they render to zero client JS. Reach for a React
  `.tsx` island **only** when you need client-side interactivity (state, event
  handlers, live charts).
- Hydrate islands with the narrowest directive that works: `client:visible` or
  `client:idle` over `client:load` when the component is below the fold.
- Interactive-tool React components live in `src/components/` and are used from
  pages under `src/pages/tools/`.

### Styling & theming

- The design system lives in `src/styles/global.css`, imported once by
  `BaseLayout`. Use the CSS custom properties (`--color-*`, `--space-*`,
  `--step-*`, `--font-*`) instead of hard-coded values so both themes and the
  fluid type scale keep working.
- Theming is driven by a `data-theme="light|dark"` attribute on `<html>`.
  **Dark is the default**: `BaseLayout` renders `<html data-theme="dark">`, so
  the theme is correct before first paint and without JS. An inline script then
  applies a stored choice (`localStorage["buy-risk-theme"]`) if the reader has
  used the toggle. `prefers-color-scheme` is deliberately NOT consulted — most
  systems report light, which would defeat the intended default. The toggle lives in `ThemeToggle.astro`.
  Never hard-code colors that won't adapt — always go through the tokens.
- Component-scoped styles use Astro `<style>` blocks. For markup rendered by a
  React island, use `<style is:global>` on the host page (see `tools/index.astro`).

### Blog posts

- Add a post by creating `src/content/blog/<slug>.md`. The filename becomes the
  URL slug (`/blog/<slug>/`).
- Frontmatter must satisfy the schema in `src/content.config.ts`: `title`,
  `description`, `pubDate` are required; `author`, `tags`, `updatedDate`,
  `draft` are optional. Set `draft: true` to keep a post out of listings and
  the build.

### Content voice

- Plain language first; define terms before using them.
- Favor the durable, well-supported findings of finance over hot takes.
- Preserve the educational-only, not-financial-advice framing site-wide.

### TypeScript & git

- Keep the codebase type-clean: run `npm run build` (or `npx astro check`)
  before committing.
- Commits are small and logical, present-tense summary line, with a Claude
  co-author trailer.
