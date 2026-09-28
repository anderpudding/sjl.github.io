# Sungjun Lee Portfolio

A personal portfolio that lives inside a terminal — and the terminal lives inside a 3D world.

## Overview

This portfolio is a space where I present my academic background, interests, writing, and personal projects. The whole site is one machine: every directory (`~/projects`, `~/journey`, `~/courses`, …) is a node in a persistent 3D constellation, and moving between pages — by clicking, or by typing `cd` in the shell at the bottom of every page — flies the camera from one node to the next.

## Features

- **Persistent 3D world** (Three.js) behind every page; navigation is a camera flight, not a page reload
- **CRT boot intro** on the first visit: a monitor powers on, boots, and the camera dives into its screen
- **A real-ish shell** on every page: `cd`, `ls`, relative paths, tab completion, history, and page-specific commands (`fold` on ~/math, `lang` on the reading pages, `mail` on ~/contact)
- **Scenes**
  - `~/journey` — scroll-driven traceroute on a dotted globe: Seoul → Tokyo → Abbotsford → Vancouver
  - `~/courses` — every UBC course on a timeline, with prerequisite links from the UBC Academic Calendar
  - `~/math` — an ASCII torus that folds out of the lattice ℂ/Λ into E(ℂ)
  - `~/projects` — projects orbit their directory; opening one flies to it
- **Bilingual writing** (Korean / English) with a reading-language toggle
- Respects `prefers-reduced-motion`; falls back to plain pages without WebGL

## Tech Stack

- [Astro](https://astro.build) (static output, view transitions, content collections)
- [Three.js](https://threejs.org)
- TypeScript
- Cloudflare Pages (site) + Cloudflare Workers (League of Legends API proxy)

## Development

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site in dist/
npm run preview    # serve dist/
```

## Adding content

| What | Where |
| --- | --- |
| A project | `src/content/projects/<slug>.md` — appears in the list, gets `/projects/<slug>`, a 3D satellite, and a shell path |
| A book review | `src/content/books/<slug>.md` — Korean and English go in `<div lang="ko">` / `<div lang="en">` blocks |
| A thought | `src/content/thoughts/<yyyy-mm-dd>.md` — same ko/en blocks |
| Courses | `src/data/courses.ts` — terms, titles, and prerequisite links |
| Bucket list | `src/data/bucketlist.ts` — mark an item done with `{ text: '…', done: true }` |
| Education route | `src/data/journey.ts` |
| Top-level pages | `src/data/routes.ts` drives the 3D nodes, the nav, and the shell |

`src/data/land-dots.ts` (the globe's continents) is generated: `npm run gen:land`.

## Project structure

```
src/
  pages/        routes (Astro)
  layouts/      Base.astro — canvas, window chrome, shell, intro gating
  components/   Terminal, Prompt, Tag, LangToggle, AsciiTorus
  scripts/      world.ts (3D scene + camera), globe.ts, course-graph.ts,
                crt-intro.ts, ascii-torus.ts, terminal.ts
  content/      projects, books, thoughts (Markdown)
  data/         routes, courses, journey, bucket list, generated land dots
worker/         Cloudflare Worker for the League of Legends stats API
public/         PDFs, snapshot data, redirects
```

## Deployment

### Site — Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect this GitHub repository.
2. Build settings: framework preset **Astro**, build command `npm run build`, output directory `dist`.
3. Environment variable `NODE_VERSION = 22` (also pinned in `.nvmrc`).

`public/_redirects` keeps the old `*.html` URLs working.

> The old site was served by GitHub Pages straight from the repository root. After this version is merged into `main`, the root no longer has an `index.html`, so switch the live domain to Cloudflare Pages (or disable GitHub Pages) at the same time.

### League of Legends API — Cloudflare Worker

```bash
npx wrangler secret put RIOT_API_KEY --config worker/wrangler.toml   # once
npm run worker:deploy
```

## Author

**Sungjun Lee**  
University of British Columbia

- GitHub: https://github.com/anderpudding
- LinkedIn: https://www.linkedin.com/in/sungjun-lee-cs/
- School Email: tjdwns@student.ubc.ca
- Personal Email: anderpuding0917@gmail.com
