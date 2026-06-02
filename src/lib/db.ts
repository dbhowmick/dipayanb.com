// D1 access. One function per write; API routes stay thin.

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  country: string | null;
  userAgent: string | null;
  // Follow-up consent. Set by gated forms (CV download); contact form omits it → stored 0.
  consent?: boolean;
}

export async function insertContactMessage(
  db: D1Database,
  msg: ContactMessage,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO contact_messages (name, email, message, country, user_agent, consent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      msg.name,
      msg.email,
      msg.message,
      msg.country,
      msg.userAgent,
      msg.consent ? 1 : 0,
    )
    .run();
}
