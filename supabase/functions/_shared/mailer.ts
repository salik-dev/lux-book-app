import nodemailer from "npm:nodemailer@6.9.16";

/**
 * SMTP sender using the same secrets as `send-booking-email`
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, optional SMTP_SECURE / SMTP_FROM).
 */

export interface MailAttachment {
  filename: string;
  /** Base64-encoded file content (set `encoding: "base64"`). */
  content: string;
  encoding?: string;
  contentType?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export class MailerError extends Error {
  constructor(readonly code: "MAIL_NOT_CONFIGURED" | "MAIL_SEND_FAILED") {
    super(code);
    this.name = "MailerError";
  }
}

export async function sendMail(message: MailMessage): Promise<void> {
  const host = Deno.env.get("SMTP_HOST")?.trim();
  const user = Deno.env.get("SMTP_USER")?.trim();
  const pass = Deno.env.get("SMTP_PASS")?.trim();
  if (!host || !user || !pass) throw new MailerError("MAIL_NOT_CONFIGURED");

  const port = Number(Deno.env.get("SMTP_PORT")?.trim() || "587");
  const secureEnv = Deno.env.get("SMTP_SECURE")?.trim().toLowerCase();
  const secure = secureEnv ? secureEnv === "true" : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    tls: { servername: host },
  });

  try {
    await transporter.sendMail({
      from: Deno.env.get("SMTP_FROM")?.trim() || user,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments,
    });
  } catch {
    throw new MailerError("MAIL_SEND_FAILED");
  }
}

// Canonical implementation lives in the dependency-free http module so callers can
// escape HTML without importing this file (and its heavy `nodemailer` dependency).
export { escapeHtml } from "./http.ts";
