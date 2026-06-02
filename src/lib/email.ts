import { Resend } from "resend";
import type { ContactInput, CvDownloadInput } from "./validation";

// Transactional email via Resend. Always call from `cfContext.waitUntil(...)` so a slow
// or failing send never blocks the API response (CLAUDE.md gotcha #8).
//
// Degrades gracefully: with no RESEND_API_KEY (e.g. local dev) it logs and returns
// instead of throwing, so the rest of the flow (validation + D1 write) still works.
//
// The `from` domain must be DNS-verified in Resend before production, or sends bounce.

interface EmailEnv {
  RESEND_API_KEY?: string;
  OWNER_EMAIL: string;
}

const FROM = "Contact form <contact@mail.dipayanb.com>";

export async function sendContactEmail(
  env: EmailEnv,
  data: ContactInput,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY unset — skipping send. Would notify ${env.OWNER_EMAIL} of message from ${data.email}.`,
    );
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: env.OWNER_EMAIL,
    replyTo: data.email, // a single reply reaches the sender
    subject: `[dipayanb.com] New message from ${data.name}`,
    text: `From: ${data.name} <${data.email}>\n\n${data.message}`,
  });

  if (error) {
    // Thrown so the waitUntil catch logs it; the user already got their 200.
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}

// CV download notification to the owner. Same degrade-gracefully behaviour as above;
// no replyTo (this is a lead notice, not a message to reply to directly).
export async function sendCvDownloadEmail(
  env: EmailEnv,
  data: CvDownloadInput,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY unset — skipping send. Would notify ${env.OWNER_EMAIL} of CV download by ${data.email}.`,
    );
    return;
  }

  const company = data.company?.trim();
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: env.OWNER_EMAIL,
    subject: `[dipayanb.com] CV downloaded by ${data.name}`,
    text:
      `Name: ${data.name}\n` +
      `Email: ${data.email}\n` +
      (company ? `Company: ${company}\n` : "") +
      `Consented to follow-up: yes\n`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
}
