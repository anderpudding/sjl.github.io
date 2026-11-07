---
title: "Remember"
tagline: "AI memorial platform that weaves many people's memories into one portrait — Next.js, Express, Supabase, GPT-4o"
summary: "Team-built AI memorial platform: contributors share memories through a link, and a multi-modal pipeline turns them into a story, voice archive, and memory constellation."
file: "remember.md"
order: 0
featured: true
tags: ["Full-stack", "AI", "LLM", "Product"]
stack: ["Next.js", "React", "Express", "Supabase", "PostgreSQL", "OpenAI GPT-4o", "AssemblyAI", "D3", "Vercel", "Render"]
skills: ["Full-stack development", "LLM pipeline design", "Prompt engineering", "Application security", "Team collaboration"]
---
<p class="proj-hero"><img src="/projects/remember/logo.webp" alt="Remember logo: a green bird above a heart, inside a circle" width="114" height="120" /></p>

## Why I built it

Remember was built with a cross-functional student team, with a PM, designers, and several engineers. I was a full-stack developer across most of the product and wrote about half of the repository's commits. The problem came from our PM's customer research: when someone dies, the memories that matter most are scattered across phones, group chats, photo albums, and the people who knew them. Nothing gathers them while they can still be gathered.

The research and product side (customer interviews, personas, and 58 user stories) is written up in the [product case study](https://watanabesota6.wixsite.com/professional-product). This page covers the engineering.

| The problem | How the product responds |
|---|---|
| Each person holds a different piece of the same life | One invite link; contributors add memories **without creating an account** |
| What people remember depends on who they were to the person | A questionnaire that **filters its questions by relationship** |
| Photos alone lose the voice and the stories | Three inputs: answers, photos, and **voice recordings** |
| A generated tribute that invents details is worse than none | Every line must **trace back to something a contributor actually said** |

## Goal

> Turn many people's separate memories of one person into a single portrait that families can keep.

Success had two parts. For contributors: a flow simple enough for a grandparent on a phone. For the output: **no invented details**, because the result describes a real person and a single made-up fact breaks the product.

## What it does

The flow has three roles, each with its own part of the app:

```
(contributor)  invite link → privacy (named or anonymous) → relationship
               → questionnaire (autosaves) → photos → voice → review → submit
(organizer)    create memorial → share invite → approve contributions
               → generate → review flagged content → share the result
(viewer)       story slideshow · constellation · voices · photo archive
```

- **Contributor flow.** Invite-token landing, onboarding, a privacy step (credit by name or anonymously), a relationship selector, and a questionnaire that autosaves as you type. Then mobile photo and voice upload, and a review screen to edit or delete anything before sending.
- **Story slideshow.** A chaptered crossfade slideshow with an opening slide, a farewell line, and credits for every contributor.
- **Constellation.** A force-directed map of shared memories. One memory told by several people becomes one node, with each person's own words attached.
- **Voices archive.** A custom audio player with a waveform and a transcript that follows the recording.
- **Organizer tools.** Approve contributions per content type, with badges for unreviewed items and bulk approve with confirmation. Generation stays locked until everything waiting has been reviewed.
- **Moderation review.** Generation flags sensitive or unrelated content and pauses for the organizer instead of publishing it.

| Output | What it is made from |
|---|---|
| Story slideshow | Photos, questionnaire answers, voice key quotes |
| Constellation | Questionnaire memories, merged across contributors |
| Voices | Recordings, transcripts with word timings |
| Photo archive | Approved photos, sorted by era and grouped into albums |

## System architecture

<figure class="shot shot-wide"><img src="/projects/remember/architecture.svg" alt="Architecture diagram: Next.js app on Vercel talks to an Express API on Render, which talks to Supabase, OpenAI GPT-4o, and AssemblyAI" loading="lazy" /><figcaption>Three audiences in one Next.js app, one API that holds every secret, three services behind it.</figcaption></figure>

The repository is split into a Next.js frontend and an Express backend, with raw SQL for the schema and migrations.

```
frontend/src/app/      Route groups: (contributor), (organizer), (viewer), (auth)
frontend/src/components/   contributor, organizer, output, viewer
frontend/src/lib/      Pure logic: story slides, constellation nodes, transcript sync
backend/src/routes/    memorials, contribute, ai, share, waitlist
backend/src/services/  Generation, moderation, bookends, voices, photo matching
backend/test/          Node's built-in test runner (297 tests pass)
migrations/            Additive SQL migrations; schema.sql for fresh installs
```

Three principles shaped the code:

1. **The browser never touches data tables.** Row-level security is on for every table with no public policies. Only the API holds the service-role key.
2. **Decisions move out of the model.** Merging, ordering, quote selection, and photo eligibility run in deterministic code. The model only judges and picks.
3. **Everything AI-related has a fallback.** A failed call leaves a gap, such as a memory with no photo, never an invented filler.

### AI pipeline

<figure class="shot shot-wide"><img src="/projects/remember/pipeline.svg" alt="Eight-step generation pipeline: gather, moderate, understand photos, match photos to albums, process voices, compose story, build constellation, save; moderation can pause the job as awaiting_review" loading="lazy" /><figcaption>One background job, started by the organizer. The dashboard polls its progress.</figcaption></figure>

The Express API writes progress to an `ai_jobs` row, and the dashboard polls it. Three steps carry most of the design:

- **Memory extraction** uses a "picturable scene" test. Only concrete who, what, and where moments qualify, and a trait label like "she was generous" does not. Two candidates merge into one memory when at least two of who, action, and setting match and nothing contradicts. Every pair in a merged group must qualify.
- **Photo-to-memory matching** attaches a photo only when era, setting plus activity, and the visible people all fit, each with evidence and confidence of at least 0.8. A hiking photo does not match a gardening memory just because both are outdoors. No match means no photo.
- **Story composition** follows strict rules: every attributed line traces to a real contribution, quotes are never rewritten, and visual details are dropped unless a contributor mentioned them too. The opening slide uses only organizer data. The farewell line and credit quotes are picked by index from real sentences, never generated.

### Data model

<figure class="shot shot-wide"><img src="/projects/remember/data-model.svg" alt="Entity diagram: memorials own invite_links, contributors, ai_jobs, and ai_outputs; contributors own questionnaire_responses, media_assets, and voice_recordings" loading="lazy" /><figcaption>The core tables. Every table has row-level security enabled.</figcaption></figure>

A few decisions worth explaining:

- **Secret session tokens, not ids.** A contributor proves who they are with a random `session_token`. The first version authorized by contributor id, but an id is an identifier, not a secret.
- **Two link types.** `invite_links.link_type` separates `contribute` links from `share` links, so a link sent to a viewer can never be used to add content.
- **Moderation decisions persist.** `moderation_resolution` (`approved` or `excluded`) and a timestamp are stored on every reviewed row. An organizer's approval is not flagged again on the next generation, and excluded items keep their original files.
- **One output document.** Story, voices, albums, and constellation are saved together in `ai_outputs.output_json`, with signed media URLs resolved at read time.
- **Additive migrations.** New columns are added and repeatable, so shipping a change never deletes records.

## Why these technologies

| Choice | Why this, not the alternative |
|---|---|
| **Next.js (App Router)** | Route groups give contributors, organizers, and viewers separate layouts in one deployable app, and Vercel hosts it. |
| **Separate Express API** (not functions inside Next.js) | Generation is a long job with many model calls, and uploads run to 25 MB per photo. A plain server is simpler for both than request-limited functions. |
| **Supabase** | Auth, Postgres, and Storage in one place. With RLS closed to the browser, the API is the only door into the data. |
| **GPT-4o for text and vision** | One provider for extraction, moderation, photo analysis, and composition, with JSON output that can be validated. |
| **AssemblyAI** (not Whisper) | The team compared the two and chose AssemblyAI. It returns word timings, which power the transcript that follows playback. |
| **D3 and react-force-graph** | A force-directed layout for the constellation without drawing the physics myself. |
| **`node --test`** | No test framework to maintain. Model calls are stubbed, so tests check guards and data flow without sending real memories to a provider. |

## Challenges

- **Trust, not features.** The output describes a real person. I treated prompts as specifications: the model returns indexes into contributors' real sentences instead of writing quotes, and contributor text is wrapped in `<source_data>` tags with an explicit rule to never follow instructions inside it, so a memory cannot hijack the prompt.
- **Moderating memories.** Uploads can be unrelated, disturbing, or private, and a bad image should not be published silently. Generation checks answers, whole contributions, and photos, then pauses as `awaiting_review`. The organizer can approve, edit, move, or leave content out. Blur is tracked separately: severe blur drops a photo from the story, mild blur does not. Photo provider failures hold the photo, and a malformed model decision can never approve content.
- **Security before launch.** I turned on RLS for every table, replaced id-based contributor authorization with session tokens, separated share links from invite links, added ownership checks to output, job-status, and invite endpoints, removed unauthenticated data endpoints, and patched dependency advisories. Uploads and contributor creation are rate limited per IP, and generation is limited to 10 starts per hour per organizer.
- **Pipeline reliability at scale.** Jobs resume instead of restarting, rate-limit (429) errors in the contributor flow are handled, and large generations no longer fail with 404s. Photo matching used to read only the first 60 photos; it now pages through the whole pool, so the best match is found even at photo 61.

## Run it locally

Requires Node, a Supabase project, and an OpenAI key. Without an OpenAI key the backend falls back to a mock provider, which is enough to run the app but cannot judge real content.

```bash
git clone https://github.com/SotaWatanabe6/Remember.git && cd Remember

# 1. Database: run schema.sql in the Supabase SQL editor (migrations/ is for existing databases)
# 2. Backend
cp .env.example backend/.env      # set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
cd backend && npm install && npm run dev          # API on :3001

# 3. Frontend (new terminal)
cd frontend && cp .env.example .env.local         # set the API URL and Supabase anon key
npm install && npm run dev                        # app on :3000
```

Voice transcripts need an `ASSEMBLYAI_API_KEY` in the backend environment. Other commands:

| Command | What it does |
|---|---|
| `npm test` (in `backend`) | Backend tests on Node's built-in runner |
| `node --test tests/*.test.*` (in `frontend`) | Frontend logic tests |
| `npm run lint` · `npm run build` (in `frontend`) | Lint and production build |

## What I learned

Remember was my first time shipping with a real team, a PM, and a sprint cadence, and most of the hard engineering was about trust. Two things changed how I build with LLMs: treat the prompt as a specification, and move every decision out of the model that code can make, so the model's job shrinks to judging and picking. Working in a shared codebase also taught me integration branches, resolving conflicts in other people's code, and writing commits that a teammate can review.

## Try it

<div class="proj-links">
  <a class="proj-link-site" href="https://remember-two-pi.vercel.app/" target="_blank" rel="noopener">remember-two-pi.vercel.app &rarr; live app</a>
  <a href="https://github.com/SotaWatanabe6/Remember" target="_blank" rel="noopener">github.com/SotaWatanabe6/Remember &rarr; source</a>
  <a href="https://watanabesota6.wixsite.com/professional-product" target="_blank" rel="noopener">product case study &rarr; PM write-up</a>
</div>
