import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Astro 6 Content Layer: the `glob` loader is mandatory. `base` is resolved from
// the project root; the entry id is derived from the filename (e.g. meldui.md -> "meldui").
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    name: z.string(),
    summary: z.string(),
    role: z.string().optional(),
    stack: z.array(z.string()),
    url: z.string().url().optional(),
    repo: z.string().url().optional(),
    status: z.string().optional(), // e.g. "In progress"
    year: z.number().int().optional(),
    order: z.number().optional(), // display order on the home grid
    featured: z.boolean().default(false),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // z.coerce.date() parses frontmatter date strings (e.g. 2026-04-01) into Date.
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, posts };
