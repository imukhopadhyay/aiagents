import "server-only";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Placeholder transport: logs messages to the server console. Swap in a real
 * provider (SMTP, Resend, SES, ...) before going to production.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  console.info(`\n[mail] To: ${message.to}\n[mail] Subject: ${message.subject}\n${message.text}\n`);
}
