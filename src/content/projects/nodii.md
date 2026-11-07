---
title: "Nodii"
tagline: "A light, date-based todo app that shows the same day on every device — Tauri, Expo, Supabase"
summary: "Solo-built, shipped todo app for Mac and iPhone: goals, calendar, and routines, synced in real time through Supabase."
file: "nodii.md"
order: 0
featured: true
tags: ["Full-stack", "Mobile", "Desktop", "Product"]
stack: ["Tauri v2", "Rust", "React 19", "TypeScript", "Expo", "React Native", "Supabase", "PostgreSQL", "TanStack Query", "Tailwind", "pnpm"]
skills: ["Product thinking", "Cross-platform architecture", "Database design & RLS", "Realtime sync", "App Store release"]
---
<p class="proj-hero"><img src="/projects/nodii/icon.webp" alt="Nodii app icon: a black fruit with a white checkmark and two green leaves" width="120" height="120" /></p>

## Why I built it

My daily todo app was Todomate, and I used it for one reason: **my phone and my computer showed the same day.** Then its desktop version moved behind a paid subscription. Rather than look for a compromise, I decided to build the replacement myself.

I read through the old app's reviews first and turned the complaints into a design brief:

| What users complained about | What Nodii does |
|---|---|
| Deleting a goal permanently deletes all of its past todos | Goals are **archived**, not deleted, so history stays |
| Few colors, no way to type a color code | Preset colors plus **HEX input** |
| Unreliable sync between devices | The server is the source of truth, with **realtime updates** |
| Install froze on M1 Macs | **Universal** build for Apple Silicon and Intel |

## Goal

> A light, clean, date-based todo app that shows the same day on every device.

Success meant three things: use it every day myself, build the account and cloud layer from day one so adding a phone later would not need a new server, and **ship it through App Store review**. It shipped on both the Mac App Store and the iOS App Store.

## What it does

<figure class="shot shot-wide"><img src="/projects/nodii/mac-01-today.webp" alt="Nodii on Mac: month calendar on the left, today's todos grouped by goal on the right" loading="lazy" /><figcaption>The Mac app: a calendar that fills with progress, and today's todos grouped by goal.</figcaption></figure>

- **Goals.** Every todo belongs to a colored goal. Archive instead of delete; keep at least one active goal.
- **Date-based todos.** Check items off and watch each calendar day fill in as the day's work is finished. Unfinished todos from the past week can be pulled into today with one button, never moved silently.
- **Routines.** Daily, weekly, or monthly repeats with an interval and chosen weekdays. Edit a routine for the whole history, or only from today on.
- **Realtime sync.** A change on the Mac shows up on the phone within seconds. Reads still work offline from a persisted cache.
- **Passwordless sign-in.** A six-digit code by email. No passwords to store or leak.
- **Korean and English.** All user-facing text lives in a message catalog.

<div class="shots">
  <figure class="shot"><img src="/projects/nodii/ios-01-today.webp" alt="iPhone app: week strip and today's todos" loading="lazy" /><figcaption>Today</figcaption></figure>
  <figure class="shot"><img src="/projects/nodii/ios-02-month.webp" alt="iPhone app: month calendar expanded" loading="lazy" /><figcaption>Month</figcaption></figure>
  <figure class="shot"><img src="/projects/nodii/ios-03-routine.webp" alt="iPhone app: routine editor" loading="lazy" /><figcaption>Routines</figcaption></figure>
  <figure class="shot"><img src="/projects/nodii/ios-04-swipe.webp" alt="iPhone app: swiping a todo to mark it done" loading="lazy" /><figcaption>Swipe to finish</figcaption></figure>
</div>

<div class="shots shots-2">
  <figure class="shot"><img src="/projects/nodii/mac-03-routine.webp" alt="Mac app: create routine dialog with weekly repeat and weekday selection" loading="lazy" /><figcaption>Routine editor (Mac)</figcaption></figure>
  <figure class="shot"><img src="/projects/nodii/mac-05-dark.webp" alt="Mac app in dark mode" loading="lazy" /><figcaption>Dark mode (Mac)</figcaption></figure>
</div>

## System architecture

<figure class="shot shot-wide"><img src="/projects/nodii/architecture.svg" alt="Architecture diagram: Tauri macOS app and Expo iOS app share @nodii/api, @nodii/core and @nodii/i18n, and talk to Supabase Auth, Postgres, and Realtime" loading="lazy" /><figcaption>Two native clients, three shared packages, one Supabase backend.</figcaption></figure>

It is a pnpm monorepo. Dependencies point one way, `apps/*` → `packages/api` → `packages/core`, and `core` imports nothing.

```
apps/desktop/     Tauri v2 app (React 19, Vite, Tailwind) + Rust shell
apps/mobile/      Expo app (React Native, Expo Router)
packages/core/    Domain logic: types, recurrence rules, date math (pure TS)
packages/api/     Supabase client, repositories, realtime subscriptions
packages/i18n/    Message catalog (ko / en)
supabase/         Migrations, pgTAP tests, email templates
```

Four principles drove every decision:

1. **The server is the source of truth.** Clients only cache. This removes most of the ways two devices can disagree.
2. **Domain logic lives apart from the UI.** Recurrence and per-day aggregation are pure functions in `@nodii/core`, so the iPhone app reused them unchanged.
3. **Keep Rust minimal.** All data work is TypeScript. Rust only handles OS integration: window, menu, and session storage.
4. **A schema that is easy to sync.** Client-generated UUIDs, automatic `updated_at`, and real `date` columns.

### Data model

<figure class="shot shot-wide"><img src="/projects/nodii/data-model.svg" alt="Entity diagram of profiles, goals, todos, routines, and routine_logs" loading="lazy" /><figcaption>Five tables, all protected by row-level security.</figcaption></figure>

A few decisions worth explaining:

- **Routines are virtual.** I store only the rule, and compute each day's occurrences on the client. Only exceptions (done or skipped) go into `routine_logs`. The alternative, materializing the next N days of rows, means jobs to extend it and messy rewrites whenever a rule changes.
- **Todo dates are `date`, not `timestamptz`.** "October 22" is a calendar day, not an instant, so changing time zone never shifts a todo.
- **Fractional-index sort keys** make a reorder update one row, which also keeps concurrent reorders on two devices from colliding.
- **Composite foreign keys** `(goal_id, user_id)` block, at the database level, creating a todo under someone else's goal.
- **Soft delete** (`deleted_at`) for goals, todos, and routines enables undo and keeps history.
- **"Edit from today on"** is one `split_routine` RPC that ends the old routine yesterday and starts the new one today, atomically.

## Why these technologies

| Choice | Why this, not the alternative |
|---|---|
| **Tauri v2** (not Electron or SwiftUI) | Installers of a few MB and low memory use. Electron ships a whole browser; SwiftUI would have meant rewriting all UI for Mac only. |
| **React 19 + TypeScript + Vite** | Fast to build in a stack I already knew, so effort went into the product. |
| **Supabase** (not a custom backend) | Auth, Postgres, and Realtime without writing server code. Row-level security gives per-user isolation inside the database. |
| **Online-first, sync-friendly schema** | Full offline writes (PowerSync) is a project of its own. I designed the schema so it can be added later, and shipped without it. |
| **TanStack Query + Zustand** | Server cache with optimistic updates and rollback in one, and tiny client state for selected date and view. |
| **Expo (React Native)** for iOS | Reuses `core` and `api` as they are. Tauri's iOS path exists but is less mature. |
| **Do not share UI across platforms** | Share tokens and text only. Swipe gestures, sheets, and navigation feel different on a phone, so each platform has its own screens. |
| **Email OTP via Resend SMTP** | No passwords. Supabase's built-in mail server is rate-limited for testing, so a custom domain with SPF and DKIM was required. |
| **pgTAP + Vitest** | The security-critical part, RLS, is tested in the database itself. Domain logic is tested as pure functions. |

<figure class="shot"><img src="/projects/nodii/ios-06-sync.webp" alt="iPhone app in dark mode with the headline: your day, in sync with Mac" loading="lazy" /><figcaption>One email, the same day on iPhone and Mac.</figcaption></figure>

## Challenges

- **Shipping through App Store review.** The riskiest part was never a feature. It was "does a sandboxed, signed Tauri app reach TestFlight?" So I did a deployment spike as stage 0, with an empty app, before writing any product code. I also built an App Review demo account path and wrote the review response document.
- **Security by construction.** Row-level security on every table, explicit table grants (the only physical `DELETE` is on `routine_logs`), and a per-user advisory lock so two concurrent requests cannot archive the last active goal.
- **A phone that is not a small Mac.** Swipe to finish, swipe the other way to move or delete, long-press for a menu. A rule I set: **anything a swipe can do must also be in the long-press menu**, so people who cannot swipe are never blocked.
- **Mobile without touching the server.** The iOS app was built as a test of the original goal: the only backend change was one config key for a minimum supported iOS version.

## Run it locally

Requires Node 22, pnpm 10, Rust (stable), Xcode Command Line Tools, and Docker Desktop with the Supabase CLI.

```bash
pnpm install
pnpm check-env                                   # verify your setup
cp apps/desktop/.env.example apps/desktop/.env.local

pnpm db:start     # local Supabase; put the printed API URL and key in .env.local
pnpm dev          # launch the Tauri desktop app
```

Sign-in emails sent locally show up at `http://127.0.0.1:54324`. Other useful commands:

| Command | What it does |
|---|---|
| `pnpm dev:web` | Desktop UI in the browser |
| `pnpm test` · `pnpm typecheck` · `pnpm lint` | Unit tests, types, lint across all packages |
| `pnpm db:test` | pgTAP tests for row-level security |
| `pnpm db:reset` | Re-apply migrations to the local DB |
| `pnpm build:appstore` | Signed `.pkg` for the Mac App Store |
| `pnpm --filter @nodii/mobile ios` | Run the iOS app in the simulator |

## What I learned

Nodii was the first product I carried alone from a complaint list to an App Store listing. The biggest lesson was to **attack the scariest unknown first**: the signing and review pipeline, not the calendar. The second was that a good boundary pays off later: keeping `core` pure TypeScript is why the iPhone app took weeks rather than months. And putting security in the database, with RLS, composite keys, and pgTAP tests, meant I never had to trust any client, including my own.

## Try it

<div class="proj-links">
  <a class="proj-link-site" href="https://nodii.app" target="_blank" rel="noopener">nodii.app &rarr; website</a>
  <a href="https://apps.apple.com/app/id6812983213" target="_blank" rel="noopener"><img src="/projects/nodii/download-on-the-app-store-white-en-us.svg" alt="Download on the App Store" width="144" height="48" /></a>
  <a href="https://apps.apple.com/app/id6812983213" target="_blank" rel="noopener"><img src="/projects/nodii/download-on-the-mac-app-store-white-en-us.svg" alt="Download on the Mac App Store" width="187" height="48" /></a>
</div>
