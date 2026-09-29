---
title: "Remember"
tagline: "AI-powered memorial platform that weaves many people's memories into one portrait — Next.js, Express, Supabase, GPT-4o"
summary: "Team-built AI memorial platform: contributors share memories through a link, and a multi-modal pipeline turns them into a story, voice archive, and memory constellation."
file: "remember.md"
order: 0
featured: true
tags: ["Full-stack", "AI", "LLM", "Product"]
stack: ["Next.js", "React", "Express", "Supabase", "PostgreSQL", "OpenAI GPT-4o", "AssemblyAI", "D3", "Vercel"]
skills: ["Full-stack development", "LLM pipeline design", "Prompt engineering", "Application security", "Team collaboration"]
---
## What it is

Remember is an AI-powered memorial platform built with a cross-functional student team. An organizer creates a memorial for someone who has passed and shares a single invite link. Family and friends then contribute through it: relationship-specific questionnaire answers, photos, and voice recordings. When the organizer is ready, an AI pipeline turns those scattered, individually-held memories into one cohesive portrait. The output is a chaptered story slideshow, a voice archive, photo albums, and an interactive "constellation" of shared memories.

The product side (customer research, personas, prioritization of 58 user stories) was led by our PM and is written up in the [product case study](https://watanabesota6.wixsite.com/professional-product). This page covers the engineering side. The app is live at [remember-two-pi.vercel.app](https://remember-two-pi.vercel.app/).

## What I built

I worked as a full-stack developer across most of the product, from the contributor experience to the generation pipeline and a security pass before launch.

- **Contributor flow.** Built the invite-token landing, onboarding, privacy step (named or anonymous credit), relationship selector, and a questionnaire that autosaves as you type and filters its questions by the contributor's relationship to the person. Then mobile photo and voice upload, and a review screen where contributors can edit or delete what they submitted before sending it.
- **Story slideshow.** Built the Story output and its crossfade slideshow. On the backend I wrote the story "bookends": an opening slide taken only from organizer data, a farewell line picked from real contributor sentences (with a fixed fallback), and contributor credits that reuse their own source quotes.
- **Memory-to-photo matching.** Linked photos to memory nodes only when three signals agree: era, setting, and who contributed. A node shows no photo rather than one that only partly fits.
- **Organizer tools.** Built the contributions approval flow (approve per content type, badges for unreviewed submissions, bulk approve with confirmation). Generation stays locked until every waiting submission has been reviewed.
- **Voices.** Built a reusable custom audio player and the voices archive tab for the organizer and viewer pages.
- **Pipeline reliability.** Fixed stuck and failing generation jobs: jobs resume instead of restarting, rate-limit (429) errors in the contributor flow are handled, and large generations no longer fail with 404s.
- **Security hardening.** Turned on Postgres row-level security for every table. Separated share links from invite links. Replaced id-based contributor authorization with secret session tokens. Added ownership checks to output, job-status, and invite endpoints, removed unauthenticated data endpoints, and patched dependency advisories.

## How the AI pipeline works

Generation runs as one background job, started by the organizer. The Express API writes progress to an `ai_jobs` table and the dashboard polls it.

1. **Gather** approved contributors, questionnaire responses, photos, and recordings.
2. **Extract memories** from questionnaire text using a "picturable scene" test. Only concrete who/action/setting moments qualify; trait labels like "she was generous" don't count. Candidates that match on at least two of three factors are merged into one memory, with every contributor who told it credited.
3. **Analyze photos** with GPT-4o vision for scene, mood, and estimated era or life stage. The results are used to sort photos chronologically and group them into albums.
4. **Transcribe voices** with AssemblyAI, then pull out a highlight clip and a key quote.
5. **Compose the story** in five chapters, under strict rules: every attributed line must trace back to a real contribution, quotes are never invented or rewritten, and visual details are left out unless a contributor mentioned them too.
6. **Save** a single output document (story, voices, albums, constellation) with signed media URLs.

## Key features

- One shareable link: contributors add memories without creating an account
- Relationship-aware questionnaire with autosave and a review step before submitting
- Multi-modal AI synthesis across text, photos, and voice, with guardrails against invented details
- Chaptered story slideshow, voice archive, photo albums, and a force-directed memory constellation
- Organizer moderation queue with per-type approval
- Row-level security, token-scoped contributor sessions, and ownership-checked APIs
- Backend and frontend tests on Node's built-in test runner

## What I learned

Remember was my first time shipping a product with a real team, a PM, and a sprint cadence. Most of the hard engineering was about trust, not features. The output describes a real person, so a single invented detail breaks the product. That pushed me to treat prompts as specifications and to move decisions out of the model wherever I could: the model picks quote indexes instead of writing quotes, merging runs in deterministic code, and every AI step has a fallback. Working on a shared codebase with several contributors also taught me a lot about integration branches, resolving conflicts in someone else's code, and writing commits that other people can review.
