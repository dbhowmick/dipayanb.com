# Design System — dipayanb.com

The visual source of truth. Goal: the modernity and clarity of Linear / Mercury / Ramp — achieved through **discipline**, not decoration. Few colors, strong hierarchy, hairline structure, generous air, motion you barely notice.

All color comes from **MeldUI's default theme tokens** (OKLCH, shadcn-style). We do **not** introduce custom hex. The design is about *which token goes where*, used with restraint.

---

## Principles

1. **Whitespace is the design.** Big vertical rhythm between sections (96–160px desktop, 56–72px mobile). Let the page breathe.
2. **One accent, used rarely.** `--primary` is the single accent — links, focus rings, one or two key CTAs. Everything else is neutral. Scarcity reads as premium.
3. **Hairlines, not boxes.** Structure with 1px `border-border` dividers and subtle borders, not heavy cards/shadows.
4. **Mono as the "engineer" tell.** Small uppercase letter-spaced Geist Mono eyebrows/labels above sections, on dates, tags, and stats. This single move does most of the technical-brand work.

---

## Color → MeldUI token mapping

Use the default theme tokens and their Tailwind utilities. Nothing custom. Dark mode is free — these tokens swap automatically under the `.dark` class.

| Design role | Token | Tailwind utility |
|---|---|---|
| Page background | `--background` | `bg-background` |
| Raised surface (cards) | `--card` | `bg-card` |
| Primary text | `--foreground` | `text-foreground` |
| Muted text (deks, meta) | `--muted-foreground` | `text-muted-foreground` |
| Hairlines / borders | `--border` | `border-border` |
| Inputs | `--input` | (MeldUI Input handles it) |
| **The single accent** (links, key CTA, hover) | `--primary` | `bg-primary` / `text-primary` |
| Focus rings | `--ring` | `ring-ring` |
| Form error states | `--destructive` | `text-destructive` |
| Form success states | `--success` | `text-success` |

**Discipline rule:** `--primary` is the *one* accent, used scarcely. Everything else is `background` / `foreground` / `muted-foreground` / `border`.

**Optional later override** (only if the owner decides to shift the accent hue or corner radius) — a single edit in `src/styles/app.css`, OKLCH, **after** the theme import. Ride the MeldUI defaults until then.

```css
@import "@meldui/vue/themes/default";

/* example only — do not apply unless decided */
:root { --primary: oklch(0.55 0.19 265); --radius: 0.625rem; }
.dark { --primary: oklch(0.70 0.17 265); }
```

---

## Rendering: static chrome vs MeldUI islands

A hard constraint shapes how this design is built (Astro 6 — see CLAUDE.md gotcha #11): **MeldUI Vue components cannot server-render.** So:

- **Static chrome** — nav, links, CTAs, badges, the stats row, section headers, cards — is **plain Astro HTML styled with MeldUI token classes** (`bg-primary`, `border-border`, `text-muted-foreground`, …). Server-rendered, zero JS, SEO-friendly. This is the default for everything non-interactive.
- **Interactive MeldUI** — the two forms, any dialog/popover — are **`client:only="vue"`** islands. They render after hydration (brief empty flash), which is fine below the fold.
- **Never** put above-the-fold critical content (hero, headings) inside a MeldUI island — it would flash empty. The hero is static HTML.

This actually reinforces the design principles: most of the site is quiet, server-rendered HTML with hairlines and tokens; MeldUI's component machinery is reserved for the few genuinely interactive surfaces.

---

## Typography

Three voices, each one job. All OFL, self-hosted via Fontsource. (Locked decision — see CLAUDE.md.)

| Use | Font | Treatment |
|---|---|---|
| Hero (H1) | **Fraunces** | 56–72px desktop, high `opsz`, `letter-spacing: -0.02em`, weight ~480 |
| Section / page titles | **Fraunces** | 32–40px, `-0.015em` |
| Body / prose | **Geist** | 17–18px, line-height 1.6, prose max-width **680px** |
| Eyebrow / labels / meta | **Geist Mono** | 12–13px, `UPPERCASE`, `letter-spacing: 0.08em`, `text-muted-foreground` |

Wire into Tailwind v4 `@theme` in `src/styles/app.css`: `--font-serif` → Fraunces, `--font-sans` → Geist, `--font-mono` → Geist Mono. Override MeldUI's default sans to Geist.

---

## Layout system

- **Container** ~1120px max, generous gutters. **Prose** 680px. **Work grid** wider, 2-col.
- **8px spacing scale.** Section padding 96–160px desktop / 56–72px mobile.
- **Header**: sticky, minimal. Name/logo left; nav right (Home · Work · Writing · About · Resume); small theme toggle. Hairline bottom border appears on scroll. No background-blur clutter.
- **Corner radius**: MeldUI default `--radius` (0.625rem) unless changed globally.

---

## Motion (subtle only)

- Scroll-in: opacity `0 → 1` + `translateY(8–12px)`, ≤300ms, `ease-out`, staggered ~60ms across a group.
- Hover: links/buttons shift to `--primary` or underline-reveal in ~150ms.
- **No** bounce, parallax, or decorative gradients. (Optional, low-priority: a single very subtle radial glow behind the hero in dark mode — Linear-style — only if it earns its place.)

---

## Page sketches

### Homepage
```
┌──────────────────────────────────────────────────────────┐
│  Dipayan Bhowmick                  Work  Writing  About ◐ │  ← hairline on scroll
├──────────────────────────────────────────────────────────┤
│                                                          │
│  WORKING ON                                  ← mono eyebrow│
│  I build systems —                           ← Fraunces 64│
│  and the teams that ship them.                            │
│  18 years across data infra, dev tools, and AI. (Geist)  │
│                                                          │
│  [ View work ]   [ Resume ↗ ]               ← primary CTA │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  $0 → $4M ARR     Apache committer    Site lead          │
│  Acceldata        Ambari              Altimate AI        │  ← Geist Mono stats, hairline-divided
├──────────────────────────────────────────────────────────┤
│  SELECTED WORK                               ← mono eyebrow│
│  ┌──────────────┐ ┌──────────────┐                       │
│  │ MeldUI       │ │ Voice Recep. │   ← border-border card │
│  │ Vue · shadcn │ │ Elixir · WS  │                       │
│  └──────────────┘ └──────────────┘                       │
├──────────────────────────────────────────────────────────┤
│  RECENT WRITING                                          │
│  2026 · 04 ─ On zero-to-revenue infra        ← mono date │
│  2026 · 01 ─ Why component libraries fail                │
└──────────────────────────────────────────────────────────┘
```

### Work
2-col grid of hairline-bordered cards; `featured: true` pinned and larger. Each card: project name (Fraunces sm), one-line summary (Geist), stack as mono tags, year top-right in mono. Hover lifts border to `--primary`.

### Writing
A list, not cards. Each row: mono date (left), Fraunces title, muted one-line dek, hairline divider. Tag filter as small mono pills. Stripe/Linear-blog feel.

### Post / Resume / About
Single 680px prose column — Fraunces headings, Geist body, mono for metadata (reading time, dates). `/resume` = web-rendered CV in this prose style + the gated download form at the bottom.

---

## Open design decisions

- **Accent hue / radius override**: none — riding MeldUI defaults unless the owner decides to shift `--primary` or `--radius`.
- **Dark-mode hero glow**: optional, low priority.
- **Analytics provider** (Plausible vs Umami): unrelated to visual design; tracked in CLAUDE.md.
