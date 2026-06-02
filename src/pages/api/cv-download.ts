import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { cvDownloadSchema } from "../../lib/validation";
import { verifyTurnstile } from "../../lib/turnstile";
import { insertContactMessage } from "../../lib/db";
import { sendCvDownloadEmail } from "../../lib/email";
import { PDF_URL } from "../../data/cv";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_INPUT" }, 400);
  }

  // Honeypot before everything: a filled `_hp` is a bot. Return success-shaped 200
  // with no DB write and no email, so we never tip off the bot.
  const hp = (raw as Record<string, unknown>)?._hp;
  if (typeof hp === "string" && hp.trim() !== "") {
    return json({ ok: true, downloadUrl: PDF_URL });
  }

  const parsed = cvDownloadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[cv-download] validation failed:", parsed.error.flatten());
    return json({ ok: false, error: "INVALID_INPUT" }, 400);
  }
  const data = parsed.data;

  const ip =
    request.headers.get("cf-connecting-ip") ?? clientAddress ?? undefined;
  const passed = await verifyTurnstile(
    data.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!passed) {
    return json({ ok: false, error: "TURNSTILE_FAILED" }, 400);
  }

  // Reuse the contact_messages table; fold company into the message and flag consent.
  const company = data.company?.trim() || null;
  const message = "CV download" + (company ? ` — ${company}` : "");
  try {
    await insertContactMessage(env.DB, {
      name: data.name,
      email: data.email,
      message,
      country: request.headers.get("cf-ipcountry"),
      userAgent: request.headers.get("user-agent"),
      consent: true,
    });
  } catch (err) {
    console.error("[cv-download] D1 insert failed:", err);
    return json({ ok: false, error: "SERVER_ERROR" }, 500);
  }

  // Email is best-effort and must not block the response.
  locals.cfContext?.waitUntil(
    sendCvDownloadEmail(env, data).catch((err) =>
      console.error("[cv-download] email send failed:", err),
    ),
  );

  return json({ ok: true, downloadUrl: PDF_URL });
};

// POST-only: anything else is 405.
export const ALL: APIRoute = () =>
  json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
