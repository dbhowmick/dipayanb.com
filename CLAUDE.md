# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

**Phase 0 (scaffold) is complete and verified** — `pnpm install` / `pnpm dev` / `pnpm build` all work. The toolchain, global stylesheet, `BaseLayout`, fonts, theme tokens, dark-mode pre-paint script, and a demo home page are in place. Phases 1–8 (layout shell, content, D1, email, API, forms, SEO, deploy) are not built yet.

**The project runs on Astro 6**, a deliberate override of the brief's Astro 5 pin (see the dated note atop `docs/requirement.md`). Several brief gotchas were written for Astro 5 and are corrected here — trust this file over the brief where they conflict.

- **`docs/requirement.md`** — authoritative build spec (phases, API contracts, acceptance criteria). Read before building.
- **`docs/design.md`** — visual source of truth (principles, MeldUI token mapping, type scale, layout, motion, page sketches).

Keep this file in sync as code lands.

## Stack (pinned — do not drift)

- **Astro 6** (`6.4.x`). `static` output is the default; routes opt into SSR per-file with `export const prerender = false` (the API endpoints).
- **`@astrojs/cloudflare` v13** adapter → deploy to **Cloudflare Workers** via Wrangler 4. **`astro dev` runs in the workerd runtime** (not Node) — this has consequences for MeldUI (see gotcha #11).
- **Vue 3.5+** islands via **`@astrojs/vue` v6**.
- **Tailwind CSS v4** (`@tailwindcss/vite`) — CSS-first config, **no `tailwind.config.js`**.
- **MeldUI** `@meldui/vue` + `@meldui/tabler-vue` (NOT `@meldui/charts-vue`) + `tw-animate-css`. Built on `reka-ui`.
- **Fonts** self-hosted via Fontsource: `@fontsource-variable/{fraunces,geist,geist-mono}`.
- **Cloudflare D1** (form storage), **Turnstile** (spam), **Resend** (transactional email).
- **TypeScript** strict, **pnpm** (Node 24). Native build scripts (`workerd`, `esbuild`, `sharp`, `vue-demi`) are allowlisted in `package.json` `pnpm.onlyBuiltDependencies`.

## Critical gotchas (these cause silent breakage)

1. **MeldUI is on a private registry.** `.npmrc` maps `@meldui:registry=https://npm.pkg.github.com` (committed, no token). Auth comes from the **user-level `~/.npmrc`** locally, and from an `NPM_TOKEN` (GitHub PAT, `read:packages`) set in the Cloudflare **build** environment for CI — without it `pnpm install` fails. Never inline the token in the repo `.npmrc`.
2. **Tailwind must scan MeldUI's dist** or components render unstyled. `src/styles/app.css` includes `@source "../../node_modules/@meldui/vue/dist/**/*.mjs"`. (This works regardless of how components are rendered, so static-chrome elements styled with MeldUI token classes get the right CSS too.)
3. **No `tailwind.config.js`.** All Tailwind config lives in CSS via `@theme` / `@source` / `@plugin`.
4. **Do not install `@vitejs/plugin-vue`.** `@astrojs/vue` owns the Vue plugin; adding both conflicts.
5. **Wire `@tailwindcss/vite` under `vite.plugins`** in `astro.config.mjs`, *not* as an Astro integration.
6. **D1 / env binding access (Astro 6):** `import { env } from "cloudflare:workers";` then `env.DB.prepare(...)`. The old `Astro.locals.runtime.env` is **removed** in adapter v13. Binding *types* come from `pnpm cf-typegen` (`wrangler types` → `worker-configuration.d.ts`), not a hand-written `env.d.ts`.
7. **Execution context:** `Astro.locals.cfContext.waitUntil(...)` (was `Astro.locals.runtime.ctx`). No `platformProxy` config is needed — adapter v13 auto-wires local bindings from `wrangler.jsonc` and reads local secrets from `.dev.vars`.
8. **Always `cfContext.waitUntil(...)` Resend calls** — never block the API response on email sending.
9. **Astro islands are isolated Vue apps.** A `<Toaster>` in one island won't receive `toast()` from another. Default: no toasts — use inline success/error UI inside each form.
10. **`@reference` in any SFC `<style>` block** that uses `@apply`. MeldUI itself ships precompiled.
11. **MeldUI Vue components must be `client:only="vue"` — they cannot SSR.** Under the workerd dev runtime, MeldUI/`reka-ui` throws on server render (`getCurrentInstance()` → null, "Cannot read … 'ce'"). `client:visible`/`client:load`/no-directive all do an SSR pass → broken in `pnpm dev`. **Rules:** (a) interactive MeldUI (forms, dialogs) → `client:only="vue"`; (b) non-interactive chrome (nav links, CTAs, badges) → plain Astro HTML styled with MeldUI **token classes** (`bg-primary`, `border-border`, …), no Vue component. `astro.config.mjs` sets `vite.resolve.dedupe: ['vue']` so the island bundle has a single Vue. Trade-off: client-only components flash empty before hydration — acceptable for forms; never put above-the-fold critical content in a MeldUI island.
12. **Barrel imports pull in Shiki.** `import { Button } from "@meldui/vue"` drags a code-highlighter (hundreds of lazy language chunks) into the build. Prefer deep imports (`@meldui/vue/<component>`) if the package exposes them, to keep island bundles lean.

## Architecture

Static-first Astro site with a thin SSR surface for two forms. Everything is prerendered except the two API routes.

**Request flow for forms** (the only dynamic path):

```
Vue island (client:only="vue") ─POST JSON─▶  /api/{cv-download,contact}.ts  (prerender=false)
  CvDownloadForm / ContactForm                 import { env } from "cloudflare:workers"
  + Turnstile widget + honeypot _hp            1. zod-validate (src/lib/validation.ts)
                                               2. honeypot non-empty → 200 {ok:true} silently
                                               3. verifyTurnstile() (src/lib/turnstile.ts) → fail = 400
                                               4. read cf-ipcountry + user-agent
                                               5. insert via src/lib/db.ts (env.DB)
                                               6. Astro.locals.cfContext.waitUntil(sendEmail → Resend)
                                               7. return {ok:true, downloadUrl?}
```

Key invariants:
- **Soft gate**: the CV PDF lives at a *public* URL (`/cv/dipayan-bhowmick-cv.pdf`). The form records the lead + emails the owner, then JS triggers the download client-side. The gate is lead-capture, not access control.
- **Honeypot before everything**: a non-empty `_hp` returns `200 {ok:true}` with no DB write and no email — never tip off bots.
- **Never echo raw zod errors** to the client. Return generic `{ ok: false, error: 'INVALID_INPUT' }` (400); `console.error` the detail server-side.
- **Contact emails set `replyTo: senderEmail`** so a single reply reaches the sender.
- Both API routes are `POST`-only (405 otherwise) and start with `export const prerender = false;`.

**Content** is two Astro content collections defined in `src/content/config.ts`: `posts` (MDX) and `projects` (MDX or YAML). `/writing` and `/work` render from these; `/rss.xml.ts` feeds from `posts`.

**Runtime types**: bindings (`DB`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `OWNER_EMAIL`) are declared in `wrangler.jsonc` and typed by `pnpm cf-typegen` (`wrangler types`), which generates `worker-configuration.d.ts` (gitignored). `src/env.d.ts` only references `astro/client`.

## Layout conventions

- `src/components/astro/` — static Astro components. `src/components/vue/` — MeldUI Vue islands (the two forms live here, used **`client:only="vue"`** — gotcha #11).
- Non-interactive UI (nav, CTAs, badges) is **plain Astro HTML with MeldUI token classes**, not Vue components — keeps it server-rendered and JS-free.
- `src/lib/` — one file per concern: `db.ts`, `email.ts`, `turnstile.ts`, `validation.ts`. Keep API routes thin; logic goes here.
- `src/styles/app.css` is the single global stylesheet, imported in `BaseLayout.astro` frontmatter (alongside the three Fontsource packages). Its `@import` / `@source` / `@theme` lines are load-bearing (gotchas 2–3).
- `migrations/` holds D1 SQL. Two tables: `cv_downloads` and `contact_messages`.

## Commands

```bash
pnpm dev                  # astro dev (workerd runtime); bindings from wrangler.jsonc, secrets from .dev.vars
pnpm build                # astro build (Cloudflare adapter → dist/)
pnpm preview              # preview the built worker
pnpm cf-typegen           # wrangler types → worker-configuration.d.ts (re-run after editing bindings)

# D1 migrations (Phase 3+)
pnpm exec wrangler d1 migrations apply dipayanb-site --local     # local dev DB
pnpm exec wrangler d1 migrations apply dipayanb-site --remote    # production DB

# Deploy (Phase 8)
pnpm exec wrangler deploy   # then apply --remote migrations
```

No test framework is set up (none specified in the brief).

## Secrets & env

- **Local dev secrets** go in **`.dev.vars`** (gitignored; see `.dev.vars.example`) — the adapter reads them automatically. NOT `.env`.
- **Production secrets** (`wrangler secret put <NAME>`): `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`. `OWNER_EMAIL` may be a plain var.
- **`NPM_TOKEN`** — needed only in the Cloudflare *build* environment (CI `pnpm install` for MeldUI). Locally, auth lives in `~/.npmrc`.
- **Public env** (Astro `PUBLIC_*`): `PUBLIC_TURNSTILE_SITE_KEY`.
- **Resend sending domain** (e.g. `mail.dipayanb.com`) must be DNS-verified *before* the first deploy or emails bounce.

## Content & copy guardrails

- Draft page copy from the CV but **rewrite in first person** — do not paste CV text verbatim.
- **Do not mention "AmpTrade" or other proprietary/current ventures** on the homepage — the owner decides what's public. Mark uncertain copy `<!-- TODO: review copy -->`.

## Dark mode (decided)

Dark mode is a **required, fully-supported feature** (not deferred). The user's theme preference is **persisted in `localStorage`**.

Implementation notes for whoever builds it:
- Persist the choice under a stable key (e.g. `theme` = `light` | `dark`); default to the OS preference (`prefers-color-scheme`) on first visit when no stored value exists.
- MeldUI is **class-based**: toggle the `.dark` class on `<html>` (it ships `@custom-variant dark (&:is(.dark *))`). Not a `data-theme` attribute.
- **Avoid FOUC**: set the initial theme from a tiny inline `<script>` in `BaseLayout.astro` `<head>` that reads `localStorage` *before* first paint — do not wait for a Vue island to hydrate.
- The toggle control itself can be a small island or a vanilla-JS button in the layout; keep the read/write logic in one place.

## Typography (decided)

Three voices, each with one job. All OFL, **self-hosted via Fontsource** (`pnpm add` each — no Google Fonts CDN call).

- **Headings — Fraunces (variable serif).** `@fontsource-variable/fraunces`. Editorial, crafted feel. Use at high optical size with reduced "soft"/`SOFT` and `WONK` axes for a sharp, confident display look — not stuffy. Applies to the hero, page titles, section headings.
- **Body — Geist.** `@fontsource-variable/geist`. Neutral, engineered, calm. Used for all prose (`/writing`, `/resume`) and general copy. The cool-sans counterweight to the warm serif.
- **Mono accent — Geist Mono.** `@fontsource-variable/geist-mono`. For labels, dates, tags, metadata, code, and credibility stats (years, ARR figures) — the "technical texture."

Wire these into Tailwind v4 via `@theme` in `src/styles/app.css` (e.g. `--font-serif` → Fraunces, `--font-sans` → Geist, `--font-mono` → Geist Mono); MeldUI's default sans tokens may be overridden to Geist. Import the Fontsource CSS in `BaseLayout.astro` (or `app.css`). Note the spelling is **Fraunces**.

## Open decisions (unresolved — confirm with owner before implementing)

- **Analytics provider**: Plausible (hosted) vs self-hosted Umami. Not chosen.
