---
title: "How I built this site"
description: "Astro on Cloudflare Workers, my own component library, and the small decisions behind a fast, quiet personal site."
pubDate: 2026-06-02
tags: ["astro", "cloudflare", "build notes"]
draft: false
---

I have rebuilt my personal site more times than I want to admit. Every version started with good intentions and ended as a half-finished design experiment I was too embarrassed to deploy. This time I gave myself one rule: ship something small that loads fast and gets out of the way. This post is the record of how it came together and the few places it fought back.

## Static first, dynamic only where it earns it

A personal site is mostly text. There is no reason to ship a runtime to render a paragraph. So the whole thing is static by default, prerendered at build time, and served as plain HTML.

I am using Astro 6 for this. The output is `static`, and individual routes opt into server rendering only when they actually need it:

```ts
// Only the two form endpoints do this. Everything else is prerendered.
export const prerender = false;
```

That single line is the whole philosophy. The home page, the work timeline, this writing section: all static. The only dynamic surface is two form handlers (a contact form and a gated CV download). Two endpoints out of the entire site. Everything else is a file on a CDN.

## Cloudflare Workers, and a dev runtime that surprised me

I deploy to Cloudflare Workers through the `@astrojs/cloudflare` adapter. The pitch is simple: static assets on the edge, and when I do need a request handler, it runs close to the user without me babysitting a server.

The part that caught me out: with the current adapter, `astro dev` does not run on Node. It runs on `workerd`, the same runtime Workers use in production. That is great for fidelity, because what I see locally is what ships. It is less great the first time a library you trusted assumes it is running on Node and quietly falls over.

Binding access changed too. The old pattern of reaching through `Astro.locals` is gone. Now it is an import:

```ts
import { env } from "cloudflare:workers";

const row = await env.DB.prepare(
  "select count(*) as n from contact_messages",
).first();
```

The binding types are generated from my `wrangler.jsonc` rather than hand-written, which means the types stay honest as I add bindings. One less file to keep in sync by hand.

## Eating my own dog food

The site is built with MeldUI, which is my own Vue component library. Building your portfolio on the thing you also maintain is a good forcing function. If a component is annoying to use here, it is annoying everywhere, and now I have to feel it.

This is also where `workerd` bit me. MeldUI is built on reka-ui, and those components expect a browser. Under the dev runtime, any attempt to server-render them throws before the page even loads. The fix is not subtle but it is clean: anything interactive renders as a client-only island.

```astro
<ContactForm client:only="vue" />
```

For the parts that are not interactive (navigation, badges, the call-to-action buttons), I do not reach for a component at all. They are plain HTML styled with the same design tokens:

```astro
<a href="/work" class="rounded-md bg-primary px-6 text-primary-foreground">
  View work
</a>
```

The result is that almost nothing on the site is a JavaScript island. The two forms hydrate; everything else is static markup that happens to share a color system with the components. Less JavaScript, same look.

## Tailwind v4 with no config file

Tailwind v4 moved configuration into CSS, and I went all in. There is no `tailwind.config.js` anywhere in this repo. The theme, the content sources, the plugins: all of it lives in one stylesheet.

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --font-serif: "Fraunces Variable", Georgia, serif;
  --font-sans: "Geist Variable", system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", monospace;
}
```

I was skeptical at first. Config in CSS felt like a category error. After living with it, I prefer it. The styling decisions are all in one place, next to the styles they affect, and there is no JavaScript config that has to be parsed and merged to understand what a class will do.

## Three typefaces, three jobs

I gave myself exactly three fonts and a rule for each one. Fraunces, a variable serif, does the headings and carries whatever personality the site has. Geist handles body text and stays out of the way. Geist Mono does the small uppercase labels, the dates, and anything that should read as a technical detail rather than prose.

All three are self-hosted through Fontsource. No call to a font CDN, no layout shift waiting on a third party, no privacy footnote. They are part of the bundle and they ship with the page.

That mono voice does most of the brand work, honestly. A small letter-spaced label above a section signals "an engineer made this" more than any amount of color would.

## Dark mode without the flash

The site is dark by default, and the choice persists across visits. The hard part of dark mode is not the colors. It is avoiding the white flash before your theme code runs.

The fix is to decide the theme before the first paint, in a tiny inline script in the document head, before anything else loads:

```html
<script is:inline>
  const stored = localStorage.getItem("theme");
  const dark = stored ? stored === "dark" : true;
  document.documentElement.classList.toggle("dark", dark);
</script>
```

It reads the saved preference, falls back to dark on a first visit, and sets the class synchronously. By the time the browser paints, the right theme is already on the page. No flash, no flicker, no theme library needed for the initial decision.

## The quiet parts

A few decisions do not show up in a screenshot but shaped the whole thing.

- The layout is a bordered grid with hairline rails. One `Section` primitive draws the full-width rules and the vertical rails, and every page composes from it. Consistency falls out of the structure instead of discipline.
- Content lives in collections and typed data modules, not in the markup. This post is a markdown file. The work history is a typed module. Editing content never means touching a layout.
- The reveal-on-scroll animation is gated on JavaScript being present and on the user not asking for reduced motion. If either is false, everything is just visible. The animation is a bonus, never a requirement for reading.

## Was it worth it

Probably more thought than a personal site needs. But the constraints were the point. Static unless proven otherwise. No JavaScript unless something is genuinely interactive. One stylesheet, three fonts, two dynamic routes.

The reward is a site that loads instantly, reads clearly, and that I actually shipped. After all the abandoned rewrites, that last part is the one that counts.
