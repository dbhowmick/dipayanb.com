import { z } from "zod";

// Contact form payload. `_hp` is the honeypot (must stay empty); `turnstileToken`
// is the Cloudflare Turnstile response token. Keep messages generic to the client —
// the API never echoes these errors back (see CLAUDE.md / requirement.md).
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(5000),
  turnstileToken: z.string().min(1),
});

export type ContactInput = z.infer<typeof contactSchema>;

// CV download (soft gate). Same anti-spam fields; `company` is optional and `consent`
// is required true — enforced here so the checkbox can't be bypassed by posting raw JSON.
export const cvDownloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(100).optional().or(z.literal("")),
  consent: z.literal(true),
  turnstileToken: z.string().min(1),
});

export type CvDownloadInput = z.infer<typeof cvDownloadSchema>;
