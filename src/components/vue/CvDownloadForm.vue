<script setup lang="ts">
import { ref, onMounted, useTemplateRef } from "vue";

// Test site key (always passes) as the default so local dev works with zero setup.
// Set PUBLIC_TURNSTILE_SITE_KEY in the build env for production.
const SITE_KEY =
  (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) ||
  "1x00000000000000000000AA";

const FALLBACK_URL = "/cv/dipayan-bhowmick-cv.pdf";

type Status = "idle" | "submitting" | "success" | "error";

const name = ref("");
const email = ref("");
const company = ref("");
const consent = ref(false);
const hp = ref(""); // honeypot — real users never fill this
const token = ref("");
const status = ref<Status>("idle");
const errorMsg = ref("");
const downloadUrl = ref(FALLBACK_URL);

const widgetEl = useTemplateRef<HTMLDivElement>("widget");
let widgetId: string | undefined;

interface Turnstile {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
}
const ts = () => (window as unknown as { turnstile?: Turnstile }).turnstile;

function loadTurnstile(): Promise<void> {
  return new Promise((resolve) => {
    if (ts()) return resolve();
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

onMounted(async () => {
  await loadTurnstile();
  const t = ts();
  if (t && widgetEl.value) {
    widgetId = t.render(widgetEl.value, {
      sitekey: SITE_KEY,
      theme: "auto",
      callback: (tok: string) => {
        token.value = tok;
      },
      "error-callback": () => {
        token.value = "";
      },
      "expired-callback": () => {
        token.value = "";
      },
    });
  }
});

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function onSubmit() {
  if (status.value === "submitting") return;
  errorMsg.value = "";

  if (!name.value.trim() || !email.value.trim()) {
    status.value = "error";
    errorMsg.value = "Please fill in your name and email.";
    return;
  }
  if (!consent.value) {
    status.value = "error";
    errorMsg.value = "Please tick the consent box to continue.";
    return;
  }
  if (!token.value) {
    status.value = "error";
    errorMsg.value = "Please complete the verification below.";
    return;
  }

  status.value = "submitting";
  try {
    const res = await fetch("/api/cv-download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        company: company.value,
        consent: consent.value,
        _hp: hp.value,
        turnstileToken: token.value,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      downloadUrl?: string;
    };
    if (res.ok && data.ok) {
      downloadUrl.value = data.downloadUrl ?? FALLBACK_URL;
      status.value = "success";
      triggerDownload(downloadUrl.value);
    } else {
      throw new Error("bad response");
    }
  } catch {
    status.value = "error";
    errorMsg.value =
      "Something went wrong. Please try again, or email me at me@dipayanb.com.";
    ts()?.reset(widgetId);
    token.value = "";
  }
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40";
const labelClass =
  "mb-1.5 block font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground";
</script>

<template>
  <div>
    <!-- Success state replaces the form entirely. -->
    <div
      v-if="status === 'success'"
      class="rounded-xl border border-border bg-card p-8 text-center"
    >
      <p class="font-serif text-2xl font-medium tracking-[-0.01em]">
        Thanks. It's downloading.
      </p>
      <p class="mt-2 text-sm leading-[1.6] text-muted-foreground">
        Your CV should be saving now. If it didn't start,
        <a
          :href="downloadUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-foreground underline underline-offset-2 transition-colors hover:text-primary"
          >download it here</a
        >.
      </p>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="cvd-name" :class="labelClass">Name</label>
        <input
          id="cvd-name"
          v-model="name"
          type="text"
          name="name"
          autocomplete="name"
          :class="inputClass"
          placeholder="Your name"
        />
      </div>

      <div>
        <label for="cvd-email" :class="labelClass">Email</label>
        <input
          id="cvd-email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          :class="inputClass"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label for="cvd-company" :class="labelClass">
          Company <span class="normal-case">(optional)</span>
        </label>
        <input
          id="cvd-company"
          v-model="company"
          type="text"
          name="company"
          autocomplete="organization"
          :class="inputClass"
          placeholder="Where you're reaching out from"
        />
      </div>

      <!-- Honeypot: visually hidden, off the tab order, ignored by humans. -->
      <div aria-hidden="true" class="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label for="cvd-website">Website</label>
        <input
          id="cvd-website"
          v-model="hp"
          type="text"
          name="_hp"
          tabindex="-1"
          autocomplete="off"
        />
      </div>

      <label class="flex items-start gap-2.5 text-sm leading-[1.5] text-muted-foreground">
        <input
          v-model="consent"
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        <span>I agree my details will be stored so Dipayan can follow up.</span>
      </label>

      <!-- Turnstile widget renders here on mount. -->
      <div ref="widget" class="min-h-[65px]"></div>

      <p
        v-if="status === 'error'"
        class="text-sm leading-[1.5] text-red-600 dark:text-red-400"
      >
        {{ errorMsg }}
      </p>

      <button
        type="submit"
        :disabled="status === 'submitting'"
        class="inline-flex h-11 w-fit items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ status === "submitting" ? "Preparing…" : "Download CV" }}
      </button>
    </form>
  </div>
</template>
