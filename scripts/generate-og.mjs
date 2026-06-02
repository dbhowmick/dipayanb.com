// Pre-build OG image generator. Runs in Node (NOT workerd), so it sidesteps the
// Cloudflare adapter's prerender sandbox. Renders one 1200x630 share card per page
// into public/og/<slug>.png with satori (markup -> SVG) + resvg (SVG -> PNG).
//
// BaseLayout points og:image at /og/<slug>.png, where <slug> is the page path
// ("/" -> "home"). Add new top-level pages to `staticPages` below; posts are
// picked up automatically from src/content/posts.
//
// Run via `pnpm og`; it's chained before `astro build` in the build script.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDir, "..");

const fraunces = fs.readFileSync(path.join(scriptsDir, "og-fonts/Fraunces.ttf"));
const geist = fs.readFileSync(path.join(scriptsDir, "og-fonts/Geist.ttf"));

const staticPages = {
  home: {
    title: "Dipayan Bhowmick",
    description: "Engineer and builder. AI, data, and the teams that ship them.",
  },
  work: {
    title: "Work",
    description:
      "Eighteen years building AI and data products, from zero to revenue.",
  },
  writing: {
    title: "Writing",
    description: "Technology, leadership, and whatever I'm into.",
  },
  about: {
    title: "About",
    description: "How I got here, how I work, and how to reach me.",
  },
  "work/download": {
    title: "Download my CV",
    description: "The full CV as a PDF.",
  },
};

// Pick up published posts straight from the markdown frontmatter.
function readPosts() {
  const dir = path.join(projectRoot, "src/content/posts");
  const out = {};
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(md|mdx)$/.test(file)) continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const fm = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const field = (k) => {
      const m = fm[1].match(new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, "m"));
      return m ? m[1] : "";
    };
    if (field("draft") === "true") continue;
    const id = file.replace(/\.(md|mdx)$/, "");
    out[`writing/${id}`] = {
      title: field("title"),
      description: field("description"),
    };
  }
  return out;
}

const text = (content, style) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children: content },
});

function card(title, description) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "1200px",
        height: "630px",
        backgroundColor: "#121212",
        padding: "70px",
        borderLeft: "16px solid #ea580c",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              text(title, {
                fontFamily: "Fraunces",
                fontWeight: 600,
                fontSize: "68px",
                color: "#fafafa",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                maxWidth: "1000px",
              }),
              text(description, {
                fontFamily: "Geist",
                fontWeight: 400,
                fontSize: "30px",
                color: "#a1a1a1",
                marginTop: "28px",
                lineHeight: 1.4,
                maxWidth: "920px",
              }),
            ],
          },
        },
        text("dipayanb.com", {
          fontFamily: "Geist",
          fontWeight: 400,
          fontSize: "26px",
          color: "#a1a1a1",
          alignItems: "center",
        }),
      ],
    },
  };
}

const pages = { ...staticPages, ...readPosts() };
const outDir = path.join(projectRoot, "public/og");
fs.mkdirSync(outDir, { recursive: true });

for (const [slug, page] of Object.entries(pages)) {
  const svg = await satori(card(page.title, page.description), {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Geist", data: geist, weight: 400, style: "normal" },
    ],
  });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();
  const outPath = path.join(outDir, `${slug}.png`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`og: ${slug}.png`);
}

console.log(`Generated ${Object.keys(pages).length} OG images → public/og/`);
