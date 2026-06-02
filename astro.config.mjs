// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Astro 6 + @astrojs/cloudflare v13.
// `static` is the default output; individual routes opt into SSR via `export const prerender = false`.
// Tailwind v4 is wired as a Vite plugin, NOT as an Astro integration.
// `site` is required for canonical URLs, the sitemap, and absolute OG image URLs.
export default defineConfig({
  site: "https://dipayanb.com",
  adapter: cloudflare(),
  integrations: [
    vue(),
    // Exclude the generated OG image endpoints from the sitemap (they're not pages).
    sitemap({ filter: (page) => !page.includes("/og/") }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Single Vue instance in the client island bundle (reka-ui relies on it).
    resolve: { dedupe: ["vue"] },
  },
});
