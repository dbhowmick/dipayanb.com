<script setup lang="ts">
import { ref, onMounted, useTemplateRef } from "vue";

// Test site key (always passes) as the default so local dev works with zero setup.
// Set PUBLIC_TURNSTILE_SITE_KEY in the build env for production.
const SITE_KEY =
  (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) ||
  "1x00000000000000000000AA";

type Status = "idle" | "submitting" | "success" | "error";

const name = ref("");
const email = ref("");
const message = ref("");
const hp = ref(""); // honeypot — real users never fill this
const token = ref("");
const status = ref<Status>("idle");
const errorMsg = ref("");

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

async function onSubmit() {
  if (status.value === "submitting") return;
  errorMsg.value = "";

  if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
    status.value = "error";
    errorMsg.value = "Please fill in every field.";
    return;
  }
  if (!token.value) {
    status.value = "error";
    errorMsg.value = "Please complete the verification below.";
    return;
  }

  status.value = "submitting";
  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        message: message.value,
        _hp: hp.value,
        turnstileToken: token.value,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (res.ok && data.ok) {
      status.value = "success";
    } else {
      throw new Error("bad response");
    }
  } catch {
    status.value = "error";
    errorMsg.value =
      "Something went wrong. Please email me directly at me@dipayanb.com.";
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
        Message sent.
      </p>
      <p class="mt-2 text-sm leading-[1.6] text-muted-foreground">
        Thanks for reaching out. I'll get back to you soon.
      </p>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
      <div>
        <label for="cf-name" :class="labelClass">Name</label>
        <input
          id="cf-name"
          v-model="name"
          type="text"
          name="name"
          autocomplete="name"
          :class="inputClass"
          placeholder="Your name"
        />
      </div>

      <div>
        <label for="cf-email" :class="labelClass">Email</label>
        <input
          id="cf-email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          :class="inputClass"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label for="cf-message" :class="labelClass">Message</label>
        <textarea
          id="cf-message"
          v-model="message"
          name="message"
          rows="5"
          :class="inputClass"
          placeholder="What's on your mind?"
        />
      </div>

      <!-- Honeypot: visually hidden, off the tab order, ignored by humans. -->
      <div aria-hidden="true" class="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label for="cf-company">Company</label>
        <input
          id="cf-company"
          v-model="hp"
          type="text"
          name="_hp"
          tabindex="-1"
          autocomplete="off"
        />
      </div>

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
        {{ status === "submitting" ? "Sending…" : "Send message" }}
      </button>
    </form>
  </div>
</template>
