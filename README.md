# dipayanb.com

Personal site for Dipayan Bhowmick. Static-first [Astro](https://astro.build) site
deployed to **Cloudflare Workers**, with a thin SSR surface for one contact form
(Cloudflare D1 + Turnstile + Resend).

- **Framework:** Astro 6 (`static` output; routes opt into SSR via `export const prerender = false`)
- **Hosting:** Cloudflare Workers via Wrangler (`astro dev` runs on the `workerd` runtime, not Node)
- **UI:** Vue 3 islands (`@astrojs/vue`), Tailwind CSS v4 (CSS-first, no config file), [MeldUI](https://github.com/meldui/meldui)
- **Fonts:** self-hosted via Fontsource (Fraunces, Geist, Geist Mono)
- **Data/services:** Cloudflare D1 (form storage), Cloudflare Turnstile (spam), Resend (transactional email)
- **Content:** Astro content collections (`posts`, `projects`) + a typed `src/data/cv.ts`

---

## Prerequisites

| Tool                 | Version  | Notes                                                                                 |
| -------------------- | -------- | ------------------------------------------------------------------------------------- |
| Node                 | **24.x** | `node -v`                                                                             |
| pnpm                 | **10.x** | `corepack enable` then `corepack prepare pnpm@latest --activate`, or install directly |
| Git                  | any      |                                                                                       |
| A GitHub token       | —        | **Required to install MeldUI** (see below)                                            |
| A Cloudflare account | —        | Production only                                                                       |

### MeldUI lives on a private registry

MeldUI is published to the GitHub Package Registry. The repo's `.npmrc` maps the scope
(committed, no token):

```
@meldui:registry=https://npm.pkg.github.com
```

The **token is never committed**. Provide it one of two ways:

- **Locally:** add it to your user-level `~/.npmrc` (not the repo's):
  ```
  //npm.pkg.github.com/:_authToken=ghp_your_token
  ```
  The token is a GitHub Personal Access Token (classic) with the **`read:packages`** scope.
- **CI:** set an `NPM_TOKEN` environment variable to that same token.

Without it, `pnpm install` fails to resolve `@meldui/*`.

---

## Local development

```bash
# 1. Clone
git clone <repo-url> dipayanb.com
cd dipayanb.com

# 2. Make sure ~/.npmrc has your GitHub token (see "MeldUI" above), then:
pnpm install

# 3. Local secrets (gitignored). Copy the example and edit:
cp .dev.vars.example .dev.vars

# 4. Create the local D1 database and apply the schema:
pnpm exec wrangler d1 migrations apply dipayanb-site --local

# 5. Run the dev server (workerd runtime; auto-wires local bindings):
pnpm dev
```

Open the URL it prints (default `http://localhost:4321`).

### Environment for local dev

Two separate files, by design:

- **`.dev.vars`** — server-side secrets, read automatically by `astro dev` (the Cloudflare
  adapter loads it; **NOT** `.env`). Gitignored.
- **`.env`** — `PUBLIC_*` build-time vars (currently just the Turnstile **site** key), inlined
  into the client bundle by Vite. Gitignored (`.env.example` is committed).

**The contact form works locally with zero setup.** The widget defaults to Turnstile's
always-pass test site key, and email is skipped (logged instead) when `RESEND_API_KEY` is
unset — the submission is still validated and written to the **local** D1. To exercise the
full path locally, set the values shown in `.dev.vars.example`:

```bash
# .dev.vars
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA   # Cloudflare's always-pass test secret
RESEND_API_KEY=re_xxxxxxxx                                  # only needed to actually send mail
```

> `OWNER_EMAIL` is a plain var in `wrangler.jsonc`, not a secret.

### Things that trip people up locally

- **Env changes need a restart.** `.dev.vars` and `.env` are read at **startup**. After editing
  either, restart `pnpm dev`. (For a production build, `PUBLIC_*` vars are baked in at
  `pnpm build` time.)
- **New content collection files need a restart.** Adding a brand-new post under
  `src/content/posts/` while `pnpm dev` is running often won't hot-reload — restart the server.
- **Test the form with `pnpm dev`, not `pnpm preview`.** `astro preview` does **not** load
  `.dev.vars`, so the Turnstile secret is missing and you'll get `TURNSTILE_FAILED`.
- **MeldUI components must be `client:only="vue"`** — they can't server-render under `workerd`.
  Non-interactive chrome is plain HTML styled with MeldUI token classes instead.

### Inspecting local form submissions

```bash
pnpm exec wrangler d1 execute dipayanb-site --local \
  --command "SELECT id, name, email, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 10;"
```

---

## Commands

```bash
pnpm dev          # astro dev (workerd runtime); loads .dev.vars + .env
pnpm build        # astro build → dist/ (also writes dist/server/wrangler.json deploy config)
pnpm preview      # preview the built worker (does NOT load .dev.vars)
pnpm cf-typegen   # wrangler types → worker-configuration.d.ts (re-run after editing bindings)

# D1 migrations
pnpm exec wrangler d1 migrations apply dipayanb-site --local    # local dev DB
pnpm exec wrangler d1 migrations apply dipayanb-site --remote   # production DB
```

---

## Production setup

A first-time, one-machine walkthrough. (CI/CD can automate steps 5–7 later.)

### 1. Authenticate wrangler

```bash
pnpm exec wrangler login      # opens a browser
pnpm exec wrangler whoami     # confirm account
```

### 2. Create the D1 database

```bash
pnpm exec wrangler d1 create dipayanb-site
```

Copy the printed `database_id` into `wrangler.jsonc`, replacing the placeholder:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "dipayanb-site", "database_id": "<paste-id>", "migrations_dir": "migrations" }
]
```

> ⚠️ The binding **must stay `DB`** — the code reads `env.DB`. Renaming it makes
> `env.DB` undefined at runtime (`Cannot read properties of undefined (reading 'prepare')`).

Then refresh the generated types:

```bash
pnpm cf-typegen
```

### 3. Apply the schema to the remote database

```bash
pnpm exec wrangler d1 migrations apply dipayanb-site --remote
```

### 4. Set up Turnstile (spam protection)

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Name it; add hostnames `dipayanb.com` (and `www.dipayanb.com`); mode **Managed**.
3. You get a **Site Key** (public) and **Secret Key** (private).
   - Site key → `PUBLIC_TURNSTILE_SITE_KEY` (set in the build env / `.env`; baked into the client).
   - Secret key → set as a Worker secret in step 6.

### 5. Set up Resend (transactional email)

1. resend.com → **Domains** → add `mail.dipayanb.com` and create the DNS records it gives you
   (SPF / DKIM / the `send.mail` MX). Wait for **Verified**.
2. Create an API key (`re_…`) → set as a Worker secret in step 6.
3. The sender is `contact@mail.dipayanb.com` and recipient is `OWNER_EMAIL` (see `src/lib/email.ts`).

### 6. Set production secrets

These are encrypted and stored against the Worker (not in any file):

```bash
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY    # the REAL secret, not the test one
```

Set `PUBLIC_TURNSTILE_SITE_KEY` (the real **site** key) in the build environment so it's
inlined when you run `pnpm build`.

### 7. Configure analytics (Umami)

Privacy-friendly analytics via [Umami](https://umami.is). The tracking script is wired into
`BaseLayout.astro` and is emitted **only in production builds** (so local dev traffic isn't
counted) and **only when a website id is set**.

1. In Umami, add the site and copy its **Website ID** (dashboard → your website → Settings →
   Website ID, or the `data-website-id` value in the tracking snippet).
2. Set `PUBLIC_UMAMI_WEBSITE_ID` in the build environment. It's a `PUBLIC_*` build-time var,
   inlined at `pnpm build` (same as the Turnstile site key): locally that's `.env`; for
   Cloudflare Git builds, the dashboard build env.
3. If your Umami dashboard shows a script host other than `https://cloud.umami.is/script.js`
   (e.g. `eu.umami.is`), also set `PUBLIC_UMAMI_SRC` to match.
4. Make sure the website's domain in Umami is `dipayanb.com`, or events get dropped.

Leaving `PUBLIC_UMAMI_WEBSITE_ID` blank disables analytics entirely. To verify before
deploying: `PUBLIC_UMAMI_WEBSITE_ID=your-id pnpm build && pnpm preview`, load a page, and
confirm the `script.js` request fires and a pageview appears in Umami.

### 8. Build and deploy

```bash
pnpm build
pnpm exec wrangler deploy -c dist/server/wrangler.json
```

`astro build` merges `wrangler.jsonc` into a generated `dist/server/wrangler.json` (adding the
worker entry, static `assets`, and auto bindings). The `-c` flag points the deploy at it.
The first deploy creates the Worker named `dipayanb-site`.

> Optional: add `"deploy": "astro build && wrangler deploy -c dist/server/wrangler.json"` to
> `package.json` scripts to make this one command.

### 9. Connect the custom domain

Dashboard → **Workers & Pages → dipayanb-site → Settings → Domains & Routes → Add** →
`dipayanb.com`.

> ⚠️ If the apex already has manually-added `A`/`CNAME` records, Cloudflare refuses
> ("Hostname already has externally managed DNS records"). **Delete the apex `A` records first**,
> then add the domain — Cloudflare replaces them with its own managed route to the Worker.
> **Do not delete** the `MX` / Resend `TXT` / DKIM records — those are email and the contact
> form depends on them.

### Verifying production

```bash
pnpm exec wrangler tail dipayanb-site     # live logs; submit the form and watch
pnpm exec wrangler d1 execute dipayanb-site --remote \
  --command "SELECT id, name, email, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5;"
```

A healthy submission logs `POST /api/contact - Ok` with **no** `(error)` line.

---

## Environment variables reference

| Name                        | Type               | Local                            | Production            | Used by                 |
| --------------------------- | ------------------ | -------------------------------- | --------------------- | ----------------------- |
| `TURNSTILE_SECRET_KEY`      | secret             | `.dev.vars` (test key)           | `wrangler secret put` | `src/lib/turnstile.ts`  |
| `RESEND_API_KEY`            | secret             | `.dev.vars` (optional)           | `wrangler secret put` | `src/lib/email.ts`      |
| `PUBLIC_TURNSTILE_SITE_KEY` | public, build-time | `.env` (optional; test fallback) | build env             | `ContactForm.vue`       |
| `PUBLIC_UMAMI_WEBSITE_ID`   | public, build-time | `.env` (optional)                | build env             | `BaseLayout.astro`      |
| `PUBLIC_UMAMI_SRC`          | public, build-time | `.env` (optional)                | build env (optional)  | `BaseLayout.astro`      |
| `OWNER_EMAIL`               | plain var          | `wrangler.jsonc`                 | `wrangler.jsonc`      | `src/lib/email.ts`      |
| `NPM_TOKEN`                 | secret             | `~/.npmrc`                       | CI build env          | `pnpm install` (MeldUI) |

Gitignored and never committed: `.dev.vars`, `.env`, `worker-configuration.d.ts`, `dist/`, `.wrangler/`.

---

## Project layout

```
src/
  components/astro/   static Astro components (chrome, cards, layout primitives)
  components/vue/     MeldUI/Vue islands — client:only (ContactForm.vue)
  content/            content collections: posts/ (MDX), projects/
  data/cv.ts          typed career data behind /work
  lib/                one file per concern: validation, turnstile, db, email
  pages/              routes; pages/api/contact.ts is the only SSR endpoint
  layouts/            BaseLayout.astro (head, fonts, theme script, header/footer)
  styles/app.css      single global stylesheet (Tailwind v4 @theme/@source/@plugin)
migrations/           D1 SQL (0001_contact_messages.sql)
public/cv/            served CV PDF
wrangler.jsonc        Cloudflare config (you edit this; dist/server/wrangler.json is generated)
```

---

## Troubleshooting

| Symptom                                                   | Cause / fix                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` fails on `@meldui/*`                       | No GitHub token. Add `read:packages` PAT to `~/.npmrc` (local) or `NPM_TOKEN` (CI).                                     |
| Components render unstyled                                | Tailwind must scan MeldUI's dist — `@source` line in `src/styles/app.css` is load-bearing.                              |
| `Cannot read properties of undefined (reading 'prepare')` | D1 binding isn't named `DB`. Fix `wrangler.jsonc`, `pnpm cf-typegen`, rebuild, redeploy.                                |
| `no such table: contact_messages` (prod)                  | Remote migration not applied: `wrangler d1 migrations apply dipayanb-site --remote`.                                    |
| Form returns `TURNSTILE_FAILED` locally                   | Using `pnpm preview` (doesn't load `.dev.vars`) or no `TURNSTILE_SECRET_KEY`. Use `pnpm dev`.                           |
| Turnstile site key change not reflected                   | `PUBLIC_*` is build-time — restart `pnpm dev`, or rebuild + redeploy for prod.                                          |
| New blog post not showing                                 | Restart `pnpm dev` (content layer caches on start).                                                                     |
| Emails not sending                                        | Check `wrangler tail` for `[contact] email send failed`; confirm Resend domain is verified and `RESEND_API_KEY` is set. |
