# Personal Website — Build Brief

A build specification for Claude Code. Read this top to bottom before starting. Build in phases, verify after each, and ask before destructive actions.

> **⚠️ Update (2026-06-01): this project now targets Astro 6, overriding decision #1 below.**
> This brief was authored for Astro 5. The owner chose Astro 6 (current latest). That switch changes the Cloudflare adapter behavior — most notably binding access, the execution context, and the dev runtime — and adds a MeldUI constraint. The Astro-5-specific instructions below have been corrected inline and marked `⚠️ Astro 6`. **Where this brief and `CLAUDE.md` disagree, trust `CLAUDE.md`** (it reflects the verified, scaffolded state).

---

## Owner & goal

- **Owner:** Dipayan Bhowmick (dipayanb.com)
- **Purpose:** Personal technical brand + portfolio. Mostly static content, with two interactive forms.
- **Tone:** Polished, corporate-clean. Restrained palette, strong typography, generous whitespace.
- **Audience priority:** founders/peers > recruiters/advisory inbound.

---

## Decisions (edit here if needed, then proceed)

| #   | Decision                  | Value                                                                                                           |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Astro major version       | ~~**Astro 5**~~ → **⚠️ Astro 6** (`6.4.x`, owner override 2026-06-01). The binding API & dev runtime differ from Astro 5 — see corrected gotchas #5/#7 and `CLAUDE.md`. |
| 2   | CV download gating        | **Soft gate**. PDF lives at a public URL; form records lead + emails owner, then JS triggers download.          |
| 3   | Spam protection           | **Cloudflare Turnstile** on both forms, plus a honeypot field.                                                  |
| 4   | Contact form notification | Email owner's inbox on every submission (same Resend pipeline as CV downloads).                                 |
| 5   | Gate form fields          | `name` (required), `email` (required), `company` (optional).                                                    |

---

## Tech stack (pinned)

- **⚠️ Astro 6** (`6.4.x`), output `static` (default) with per-route `prerender = false` for API endpoints
- **`@astrojs/cloudflare` v13** adapter, deploying to **Cloudflare Workers** (note: `astro dev` runs in the workerd runtime, not Node)
- **Vue 3.5+** as an island framework via **`@astrojs/vue`**
- **Tailwind CSS v4** via **`@tailwindcss/vite`** plugin (CSS-first config — **no `tailwind.config.js`**)
- **MeldUI**: `@meldui/vue` + `@meldui/tabler-vue` (do **not** install `@meldui/charts-vue` — not needed)
- **`tw-animate-css`** (MeldUI animation dependency)
- **Cloudflare D1** for form submissions
- **Cloudflare Turnstile** for form protection
- **Resend** for transactional email
- **TypeScript** strict, **pnpm** as the package manager
- **Hosting:** Cloudflare Workers via Wrangler

---

## Critical gotchas (do not skip)

1. **MeldUI is on a private registry.** Packages are hosted on GitHub Package Registry. You need `.npmrc` with `@meldui:registry=https://npm.pkg.github.com` and `NPM_TOKEN` (GitHub PAT with `read:packages`). The same `NPM_TOKEN` must be set as a build secret in Cloudflare or `pnpm install` will fail in CI.
2. **Tailwind v4 must scan the MeldUI dist.** In the main CSS file, you must include `@source "../node_modules/@meldui/vue/dist/**/*.mjs"` — otherwise MeldUI components will render unstyled.
3. **No `tailwind.config.js`.** Tailwind v4 CSS-first — all config goes in CSS via `@theme`, `@source`, `@plugin`.
4. **Do NOT install `@vitejs/plugin-vue` manually.** The `@astrojs/vue` integration owns the Vue plugin. Adding both conflicts.
5. **⚠️ Astro 6 — D1 binding access:** `import { env } from "cloudflare:workers";` then `env.DB.prepare(...)`. The Astro 5 pattern `Astro.locals.runtime.env` is **removed** in adapter v13. (This brief originally said the opposite — it is now inverted for Astro 6.) Binding *types* come from `pnpm cf-typegen` (`wrangler types`), not a hand-written `env.d.ts`.
6. **Astro islands are isolated Vue apps.** A MeldUI `<Toaster>` mounted in one island will not receive `toast()` calls from a different island. If you need toasts, keep the trigger and the `<Toaster>` inside the same hydrated component tree. Default for this project: no toasts; use inline success/error UI inside each form.
7. **⚠️ Astro 6 — `waitUntil()` for Resend calls.** A slow email send must not delay the user's response. Access via `Astro.locals.cfContext.waitUntil(...)` (was `Astro.locals.runtime.ctx`).
9. **⚠️ Astro 6 — MeldUI components cannot SSR; render them `client:only="vue"`.** Under the workerd dev runtime, MeldUI/reka-ui throws on server render. Any SSR pass (`client:visible`, `client:load`, or no directive) breaks `pnpm dev`. Use `client:only="vue"` for interactive MeldUI (forms); build non-interactive chrome as plain HTML styled with MeldUI **token classes**. See `CLAUDE.md` gotcha #11.
8. **`@reference` for SFC `<style>` blocks.** Only relevant if you write your own Vue/Astro `<style>` blocks that use `@apply`. MeldUI ships precompiled and handles its own styling.

---

## Repository layout

```
.
├── astro.config.mjs
├── wrangler.jsonc
├── .npmrc                 # GitHub Package Registry config (not committed if it contains tokens — use env)
├── .env.example
├── tsconfig.json
├── package.json
├── public/
│   └── cv/dipayan-bhowmick-cv.pdf   # the gated download target (soft-gate: this URL is public)
├── src/
│   ├── styles/app.css
│   ├── layouts/BaseLayout.astro
│   ├── components/
│   │   ├── astro/              # static Astro components
│   │   └── vue/                # MeldUI-based Vue islands (forms live here)
│   │       ├── CvDownloadForm.vue
│   │       └── ContactForm.vue
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── work.astro
│   │   ├── now.astro
│   │   ├── resume.astro
│   │   ├── contact.astro
│   │   ├── writing/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   │   ├── rss.xml.ts
│   │   └── api/
│   │       ├── cv-download.ts
│   │       └── contact.ts
│   ├── content/
│   │   ├── config.ts
│   │   ├── projects/           # project entries (MDX or YAML)
│   │   └── posts/              # blog posts (MDX)
│   ├── lib/
│   │   ├── db.ts               # D1 helpers
│   │   ├── email.ts            # Resend client
│   │   ├── turnstile.ts        # token verification
│   │   └── validation.ts       # input schemas (zod)
│   └── env.d.ts                # types for runtime.env bindings
└── migrations/                 # D1 SQL migrations
    └── 0001_init.sql
```

---

## Phase 0 — Scaffold (verify before continuing)

1. `pnpm create astro@latest` → minimal template, TypeScript strict.
2. `pnpm astro add cloudflare` (adapter) and `pnpm astro add vue`.
3. Create `.npmrc` (see Critical Gotcha #1). Set `NPM_TOKEN` locally via `.env` or shell.
4. `pnpm add @meldui/vue @meldui/tabler-vue vue`.
5. `pnpm add -D tailwindcss @tailwindcss/vite tw-animate-css zod`.
6. Wire `@tailwindcss/vite` into `astro.config.mjs` under `vite.plugins` (not as an Astro integration).
7. Create `src/styles/app.css` with exactly:

   ```css
   @import "tailwindcss";
   @import "tw-animate-css";
   @import "@meldui/vue/themes/default";

   @source "../**/*.{astro,vue,js,ts,jsx,tsx,md,mdx}";
   @source "../../node_modules/@meldui/vue/dist/**/*.mjs";
   ```

8. Import `app.css` in `BaseLayout.astro` frontmatter.
9. Set `output: 'static'` in `astro.config.mjs`; the API routes will opt into SSR per-file.
10. **Verify:** `pnpm dev` runs; a stub home page renders with a MeldUI `<Button>` correctly styled.

---

## Phase 1 — Base layout, design tokens, static shell

1. `BaseLayout.astro` with: `<html lang="en">`, meta tags (title, description, OG, Twitter card, canonical), favicon, the global stylesheet import, a `<slot />`, a shared header (logo/name + nav: Home, Work, Writing, About, Resume) and a footer (email + LinkedIn + GitHub + copyright).
2. Use MeldUI's default theme tokens; do not introduce a custom color palette in this phase.
3. Build static page shells for: `/`, `/about`, `/work`, `/now`, `/resume`, `/contact`, `/writing`. Use placeholder content sourced from the CV (see "Page content" below) — keep it editable and clearly marked `<!-- TODO: review copy -->`.
4. Responsive: mobile-first; max content width ~720px for prose, wider grid for `/work`.
5. **Verify:** all routes render, navigation works, Lighthouse mobile score on `/` is 95+ in all four categories.

---

## Phase 2 — Content collections (blog + projects)

1. `src/content/config.ts` — define two collections: `posts` (MDX, schema: title, description, pubDate, updatedDate?, tags[], draft?) and `projects` (MDX or YAML, schema: name, summary, role, stack[], url?, repo?, year, featured?).
2. `/writing/index.astro` lists non-draft posts sorted by date desc, with tag filter UI (static — list of tags).
3. `/writing/[slug].astro` renders a single post (prose typography, reading time, dates, tags, prev/next).
4. `/work` lists projects, with `featured: true` projects pinned at the top.
5. `/rss.xml.ts` — RSS feed for posts (use `@astrojs/rss`).
6. Seed content: create 2 placeholder posts and 5 project entries pulled from the CV's "Personal Projects" section (AI Voice Receptionist, MeldUI, Personal Data Analyst, DiningBuddy.ca, Open Source). Mark them `<!-- TODO -->` where copy needs review.
7. **Verify:** `/writing` and `/work` render, RSS validates, individual post page renders.

---

## Phase 3 — D1: schema, bindings, helpers

1. **Create database:** `wrangler d1 create dipayanb-site` — record the `database_id` it returns.
2. **`wrangler.jsonc`:**
   ```jsonc
   {
     "name": "dipayanb-site",
     "compatibility_date": "2025-06-01",
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "dipayanb-site",
         "database_id": "<paste-id-here>",
       },
     ],
   }
   ```
3. **⚠️ Astro 6 — `astro.config.mjs`** needs **no** `platformProxy`. Adapter v13 auto-wires local bindings from `wrangler.jsonc` (dev runs on workerd) and reads local secrets from `.dev.vars`. Just `adapter: cloudflare()`.
4. **⚠️ Astro 6 — binding types are generated, not hand-written.** Declare `DB`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `OWNER_EMAIL` in `wrangler.jsonc`, then run `pnpm cf-typegen` (`wrangler types`) → `worker-configuration.d.ts` (gitignored). `src/env.d.ts` only needs `/// <reference types="astro/client" />`. Do **not** write the `Runtime<ENV>` / `App.Locals` block — that was the Astro 5 pattern.
5. **Migration `migrations/0001_init.sql`:**

   ```sql
   CREATE TABLE cv_downloads (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     email TEXT NOT NULL,
     company TEXT,
     country TEXT,
     user_agent TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX idx_cv_downloads_created_at ON cv_downloads(created_at);
   CREATE INDEX idx_cv_downloads_email ON cv_downloads(email);

   CREATE TABLE contact_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     email TEXT NOT NULL,
     message TEXT NOT NULL,
     country TEXT,
     user_agent TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);
   ```

6. Apply locally: `wrangler d1 migrations apply dipayanb-site --local`. Apply remotely: `wrangler d1 migrations apply dipayanb-site --remote`.
7. **`src/lib/db.ts`** — thin helpers `insertCvDownload(env, data)` and `insertContactMessage(env, data)`, returning the inserted id.
8. **`src/lib/validation.ts`** — `zod` schemas:
   - `cvDownloadSchema`: `name` (min 1, max 100), `email` (email, max 254), `company` (optional, max 100), `turnstileToken` (required), `_hp` (honeypot — must be empty).
   - `contactSchema`: `name`, `email`, `message` (min 10, max 5000), `turnstileToken`, `_hp`.
9. **Verify:** in a temporary test route, insert a row, read it back, log the result.

---

## Phase 4 — Resend + Turnstile

1. **`src/lib/turnstile.ts`** — `verifyTurnstile(token, secret, ip?)` posts to `https://challenges.cloudflare.com/turnstile/v0/siteverify` and returns `success: boolean`.
2. **`src/lib/email.ts`** — `sendEmail(env, { to, subject, html, replyTo? })` calls `POST https://api.resend.com/emails` with `Authorization: Bearer ${env.RESEND_API_KEY}`. Sender: `notify@dipayanb.com` (or another verified subdomain — must be verified in Resend before launch).
3. Provide two specific email helpers:
   - `notifyCvDownload(env, { name, email, company })` → subject "CV download: {name} ({company})", short HTML body with the fields.
   - `notifyContact(env, { name, email, message })` → subject "Contact: {name}", body with the message, **set `replyTo: email`** so a single tap replies directly to the sender.
4. Recipient is `env.OWNER_EMAIL`.

---

## Phase 5 — API endpoints

Both endpoints live in `src/pages/api/`, both start with `export const prerender = false;` and accept `POST` only (return 405 on others).

### `POST /api/cv-download`

1. Parse JSON; validate with `cvDownloadSchema`. Honeypot non-empty → return 200 with `{ ok: true }` silently (don't tip off bots).
2. Verify Turnstile token. Fail → 400.
3. Read `country` from `Astro.request.headers.get('cf-ipcountry')` (or `request.cf` on the runtime) and `user-agent`.
4. Insert into `cv_downloads`.
5. **Fire-and-forget email:** `ctx.waitUntil(notifyCvDownload(env, {...}))`.
6. Return `{ ok: true, downloadUrl: '/cv/dipayan-bhowmick-cv.pdf' }`. Client-side triggers the download from this URL.

### `POST /api/contact`

1. Same validation + Turnstile + cf-ipcountry pattern.
2. Insert into `contact_messages`.
3. `ctx.waitUntil(notifyContact(env, {...}))`.
4. Return `{ ok: true }`.

**Error handling:** never echo raw zod errors to the client — return a generic `{ ok: false, error: 'INVALID_INPUT' }` with 400. Log details server-side via `console.error`.

**⚠️ Astro 6 — pattern for binding access:**

```ts
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request, locals }) => {
  // env.DB, env.RESEND_API_KEY are available directly from the import.
  // Execution context comes from locals.cfContext:
  locals.cfContext.waitUntil(/* ... */);
};
```

---

## Phase 6 — The two MeldUI form islands

Both forms are Vue components in `src/components/vue/`, used as **`client:only="vue"`** islands (⚠️ Astro 6: MeldUI cannot SSR — see gotcha #9).

### `CvDownloadForm.vue`

- MeldUI `Input` for name, email, company, plus a hidden honeypot input named `_hp` (visually hidden via `aria-hidden` + `tabindex="-1"` and CSS).
- Cloudflare Turnstile widget (use the official script — render mode `managed`, theme matching site).
- Submit button: MeldUI `Button`, disabled while pending.
- One-line consent: "I agree my details will be stored so Dipayan can follow up." (small text, required checkbox).
- On submit: POST to `/api/cv-download` → on `ok`, create a hidden `<a>` with `download` attribute pointing to `downloadUrl` and click it; show inline success state ("Downloading…").
- On error: inline error message, do not unmount the form.

### `ContactForm.vue`

- MeldUI `Input` (name, email) + `Textarea` (message, min 10 chars).
- Honeypot + Turnstile widget + consent line.
- Submit: POST to `/api/contact` → on `ok`, replace form with a success message ("Thanks — I'll get back to you.").

### Usage in pages

- `CvDownloadForm` lives on `/resume` (and optionally as a CTA section on `/about`).
- `ContactForm` lives on `/contact`.
- Both: `<CvDownloadForm client:only="vue" />` (⚠️ Astro 6 — no SSR for MeldUI; the form renders after hydration).

---

## Phase 7 — SEO, a11y, performance, analytics

1. **Per-page meta:** title, description, canonical, OG image, Twitter card. Use a `<SEO>` Astro component fed from frontmatter / page props.
2. **Structured data:** Person schema on `/` and `/about` (JSON-LD).
3. **`sitemap.xml`** via `@astrojs/sitemap`.
4. **`robots.txt`** allowing all, pointing to sitemap.
5. **A11y:** verify focus rings on all interactive MeldUI components, alt text on every image, semantic landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`), `aria-label` on icon-only buttons, color contrast WCAG AA.
6. **Analytics:** Plausible (hosted) or self-hosted Umami — script in `BaseLayout.astro`, no cookies, no banner needed.
7. **Image optimization:** use Astro `<Image />` for any raster image; SVG preferred for logos/icons (Tabler icons are SVG already).

---

## Phase 8 — Deployment

1. **Cloudflare secrets** (set via `wrangler secret put`):
   - `RESEND_API_KEY`
   - `TURNSTILE_SECRET_KEY`
   - `OWNER_EMAIL` (can be plain env var, not secret)
   - `NPM_TOKEN` — set in the Cloudflare build environment for `pnpm install` to fetch MeldUI
2. **Public env** (Astro `PUBLIC_*` in `.env`):
   - `PUBLIC_TURNSTILE_SITE_KEY`
3. **Verify Resend sending domain** (e.g. `mail.dipayanb.com`) — add DNS records and confirm before first deploy or emails will bounce.
4. **First deploy:** `wrangler deploy` (or via Git integration). Apply remote migrations after deploy.
5. **Smoke test on production:** submit each form once, confirm D1 rows appear, confirm both emails arrive.

---

## Page content (placeholders to draft)

Pull from `/mnt/user-data/uploads/dipayan-bhowmick-cv.pdf` (the CV) for initial copy. **Do not paste the CV verbatim** — rewrite in first person where appropriate.

- **`/`**: hero (name, one-liner positioning), 3–4 credibility proof points (Acceldata $0→$4M ARR, Apache Ambari committer, 18 years across the stack, India site lead Altimate AI), 3 featured projects strip, 2 latest writing pieces, footer CTA.
- **`/about`**: career narrative arc (Hortonworks/Apache → Flipkart scale → Acceldata zero-to-revenue → Altimate agentic AI → building independently). Show range: "owns architecture, team, and GTM in equal measure."
- **`/work`**: curated portfolio. Seed entries: AI Voice Receptionist (Elixir + WebSockets, ElevenLabs/Cartesia), MeldUI (Vue/shadcn component library), Personal Data Analyst (Tauri + Rust + Vue + DuckDB + Anthropic), DiningBuddy.ca, Open Source (Jido, Kreuzberg). Mark which can be public; leave proprietary work as a `<!-- TODO -->`.
- **`/now`**: short, dated "current focus" snapshot. Owner will fill.
- **`/resume`**: web rendering of the CV + the CV download form (gated). Soft gate — the public PDF URL is `/cv/dipayan-bhowmick-cv.pdf`.
- **`/contact`**: short intro + ContactForm.

---

## Design tokens & style direction

- **Aesthetic:** polished, corporate-clean. Restrained palette (near-black on white/off-white, one accent), strong typographic hierarchy, generous whitespace, subtle motion only.
- **Typography:** stick with MeldUI's default sans for UI; consider Inter or Geist for the base. For long-form prose, a tasteful serif is encouraged (Charter, Source Serif) — propose options before adding.
- **Color:** use MeldUI default tokens. Do not introduce a new palette unless asked.
- **Motion:** opacity + small translate on scroll-in, ≤300ms. No bounce, no parallax, no decorative gradients.
- **Dark mode:** scaffold the toggle but do not prioritize polishing it; phase 2 concern.

---

## What NOT to do

- Do not install `@meldui/charts-vue`.
- Do not create `tailwind.config.js`.
- Do not install `@vitejs/plugin-vue` alongside `@astrojs/vue`.
- ~~Do not use Astro 6 binding patterns~~ → **⚠️ reversed:** on Astro 6 you MUST use `import { env } from "cloudflare:workers"` (gotcha #5).
- Do not paste CV text verbatim into pages — rewrite in first person.
- Do not commit `.npmrc` if it embeds a token; use environment variables.
- Do not skip the `@source` directive for `node_modules/@meldui/vue/dist/**/*.mjs`.
- Do not block the API response on the Resend call — always `ctx.waitUntil`.
- Do not echo validation errors raw to the client.
- Do not generate a homepage that mentions "AmpTrade" or other current/proprietary ventures — owner will decide what's public.

---

## Acceptance criteria

- [ ] All routes render and pass Lighthouse mobile ≥95 in all four categories on `/`, `/about`, `/work`, `/writing`.
- [ ] CV download form: submitting valid data inserts a row in `cv_downloads`, sends an email to `OWNER_EMAIL`, and triggers the PDF download in the browser.
- [ ] Contact form: submitting valid data inserts a row in `contact_messages` and sends an email to `OWNER_EMAIL` with `Reply-To` set to the sender.
- [ ] Both forms reject submissions with a failed Turnstile token (400).
- [ ] Honeypot submissions return 200 silently and do not insert a row or send an email.
- [ ] Resend calls do not block the API response (verified by reasonable response latency under a slow-network simulation).
- [ ] Site deploys via `wrangler deploy`; D1 migrations applied remotely; all secrets set; sending domain verified.
- [ ] `robots.txt`, `sitemap.xml`, and `/rss.xml` are reachable.

---

## Final task — generate `CLAUDE.md`

When the project is functional and acceptance criteria are met, generate a `CLAUDE.md` at the repo root summarizing for future sessions:

- The tech stack and version pins
- The non-obvious gotchas (the "Critical gotchas" section, condensed)
- Repository layout and conventions
- How to run dev / apply migrations / deploy
- Where secrets live and how to set them
- Open known issues, if any

Keep `CLAUDE.md` under 200 lines.
