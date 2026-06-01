// Server-side Cloudflare Turnstile verification.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Local dev: the documented ALWAYS-PASSES test secret is
//   1x0000000000000000000000000000000AA
// paired with the test site key 1x00000000000000000000AA in the widget.

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string,
  secret: string | undefined,
  ip?: string,
): Promise<boolean> {
  if (!secret) {
    // No secret configured (e.g. a misconfigured deploy). Fail closed.
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set; rejecting.");
    return false;
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification request failed:", err);
    return false;
  }
}
