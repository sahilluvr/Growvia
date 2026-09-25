import "server-only";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { decrypt } from "../server/crypto";
import type { Mailbox } from "./types";

type Creds = Pick<Mailbox, "smtp_host" | "smtp_port" | "smtp_secure" | "imap_host" | "imap_port" | "username"> & { password: string };

export function credsOf(m: Mailbox): Creds {
  return { ...m, password: decrypt(m.password_enc) };
}

function smtp(c: Creds) {
  return nodemailer.createTransport({
    host: c.smtp_host,
    port: c.smtp_port,
    secure: c.smtp_secure,
    requireTLS: !c.smtp_secure && c.smtp_port === 587,
    auth: { user: c.username, pass: c.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: process.env.GROWVIA_INSECURE_TLS === "1" ? { rejectUnauthorized: false } : undefined,
  });
}

export function imapClient(c: Creds) {
  return new ImapFlow({
    host: c.imap_host!,
    port: c.imap_port,
    secure: c.imap_port === 993,
    auth: { user: c.username, pass: c.password },
    logger: false,
    socketTimeout: 20000,
    tls: process.env.GROWVIA_INSECURE_TLS === "1" ? { rejectUnauthorized: false } : undefined,
  });
}

/** Checks SMTP login and (if set) IMAP login. Returns a human-readable error or null. */
export async function verifyCreds(c: Creds): Promise<string | null> {
  try {
    await smtp(c).verify();
  } catch (e) {
    return `Couldn't sign in to send email (SMTP ${c.smtp_host}:${c.smtp_port}): ${friendlyMailError(e)}`;
  }
  if (c.imap_host) {
    const client = imapClient(c);
    try {
      await client.connect();
      await client.logout();
    } catch (e) {
      return `Sending works, but couldn't sign in to read replies (IMAP ${c.imap_host}:${c.imap_port}): ${friendlyMailError(e)}`;
    }
  }
  return null;
}

export function friendlyMailError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/535|auth|credentials|invalid login|LOGIN failed/i.test(m)) return "wrong username or password (for Gmail, use an App Password).";
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return "server address not found.";
  if (/ETIMEDOUT|timeout/i.test(m)) return "connection timed out — check the server and port.";
  if (/ECONNREFUSED/.test(m)) return "connection refused — check the port.";
  return m.slice(0, 200);
}

export type Outgoing = {
  from: { name: string; address: string };
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string; // with angle brackets
  inReplyTo?: string | null;
  references?: string[];
  listUnsubscribe?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
};

export async function sendMail(c: Creds, o: Outgoing) {
  const info = await smtp(c).sendMail({
    from: o.from,
    to: o.to,
    subject: o.subject,
    text: o.text,
    html: o.html,
    messageId: o.messageId,
    inReplyTo: o.inReplyTo ?? undefined,
    references: o.references?.length ? o.references : undefined,
    headers: o.listUnsubscribe ? { "List-Unsubscribe": `<${o.listUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
    attachments: o.attachments,
  });
  return info;
}
