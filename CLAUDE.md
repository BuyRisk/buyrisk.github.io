# CLAUDE.md

Guidance for working in the **Buy Risk** codebase.

## Project purpose

Buy Risk is an **investing-education website**. Its thesis is in the name:
expected return is compensation for bearing risk that cannot be diversified
away (idiosyncratic, company-specific risk earns no premium). The site
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

## Two machines — assume the repo moved without you

**Colin works on two computers** (desktop `Colin-desktop` and laptop `Colin`),
both mounting the T7 Shield as `E:`. GitHub is the only thing that syncs
between them, and only for this repo. A session that assumes the working copy
is where it left it will clobber or duplicate work. Full machine details and
the drive's gotchas: `E:\Finance\WORKSTATIONS.md` (outside the repo).

**Standing duties for every session — Claude does these unprompted:**

1. **On waking up after a gap.** If it has been more than a day or two since
   the last session, or you cannot tell, check sync BEFORE touching a file.
   Work committed on the other machine will not be in the working copy.
2. **When a session winds down**, and whenever a work session produced
   commits, remind Colin to push. Do not let a session end with unpushed
   commits.
3. **If `git log -1` is more than a week old**, say so and offer the sync
   block, even if the tree is clean. A week-old local `main` usually means the
   other machine is ahead.

**Give the commands, don't run them.** Colin's preference: he pastes git
push/pull into his Anaconda Prompt himself rather than having a session run
them. So *offer a complete, paste-ready block* — always starting with the
`cd` line, then a check, then the action. Never a bare `git push`. Claude may
still run read-only git commands (`fetch`, `status`, `log`, `diff`) to answer
a question.

The Anaconda Prompt is `cmd`-based, so the directory line uses `cd /d`. In
PowerShell, drop the `/d`.

**Sync check — start of session, or after any gap:**

```
cd /d E:\Finance\BuyRisk
git fetch origin
git status -sb
git log --oneline -3
```

`## main...origin/main` with nothing after it means synced. `[behind N]`
means the other machine pushed; pull before working:

```
cd /d E:\Finance\BuyRisk
git pull --ff-only origin main
```

**Push — end of session, or before switching machines:**

```
cd /d E:\Finance\BuyRisk
git status -sb
git add -A
git commit -m "Present-tense summary" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

If the pull is not fast-forward, both machines have commits. Stop and sort it
out deliberately rather than merging blind.

Two more cross-machine notes: **the licensed data library never syncs** (it
lives only on the T7 at `E:\Finance\data\sources`), which is why generated
outputs under `src/data/generated/` are committed. And **Claude's memory is
per-machine** (`C:\Users\<user>\.claude\`), so anything durable belongs in
this file or in `WORKSTATIONS.md`, not in memory alone.
