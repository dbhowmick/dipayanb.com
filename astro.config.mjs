// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";

// Astro 6 + @astrojs/cloudflare v13.
// `static` is the default output; individual routes opt into SSR via `export const prerender = false`.
// Tailwind v4 is wired as a Vite plugin, NOT as an Astro integration.
export default defineConfig({
  adapter: cloudflare(),
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
    // Single Vue instance in the client island bundle (reka-ui relies on it).
    resolve: { dedupe: ["vue"] },
  },
});
