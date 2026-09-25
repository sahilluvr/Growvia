export type Mailbox = {
  id: string; owner_id: string; label: string; from_name: string; from_email: string;
  smtp_host: string; smtp_port: number; smtp_secure: boolean; imap_host: string | null; imap_port: number;
  username: string; password_enc: string; daily_limit: number; signature: string | null;
  status: "connected" | "error"; last_error: string | null; imap_last_uid: number; imap_uidvalidity: number | null;
  last_sync_at: string | null; created_at: string;
};
export type Template = { id: string; owner_id: string; name: string; category: string; subject: string; body: string; created_at: string; updated_at: string };
export type Sequence = {
  id: string; owner_id: string; name: string; status: "draft" | "active" | "paused" | "completed"; mailbox_id: string | null;
  stop_on_reply: boolean; send_days: number[]; send_start: number; send_end: number; timezone: string; created_at: string;
};
export type Step = { id: string; owner_id: string; sequence_id: string; position: number; wait_days: number; subject: string; body: string };
export type Enrollment = {
  id: string; owner_id: string; sequence_id: string; lead_id: string; step_index: number;
  status: "active" | "replied" | "completed" | "unsubscribed" | "bounced" | "failed" | "stopped";
  next_run_at: string; thread_id: string | null; last_error: string | null; created_at: string;
};
export type Thread = { id: string; owner_id: string; lead_id: string | null; subject: string; last_message_at: string; unread: boolean; status: "open" | "closed"; created_at: string };
export type Message = {
  id: string; owner_id: string; thread_id: string; lead_id: string | null; direction: "out" | "in"; from_email: string | null; to_email: string | null;
  subject: string | null; body_text: string | null; body_html: string | null; message_id: string | null; in_reply_to: string | null;
  status: "scheduled" | "sending" | "sent" | "failed" | "received"; scheduled_at: string | null; sent_at: string | null;
  opened_at: string | null; open_count: number; clicked_at: string | null; click_count: number; error: string | null;
  sequence_id: string | null; step_id: string | null; mailbox_id: string | null; created_at: string;
};
export type BookingPage = {
  id: string; owner_id: string; slug: string; title: string; description: string | null; duration: number; days: number[];
  start_hour: number; end_hour: number; timezone: string; location: string | null; active: boolean;
};
export type Booking = { id: string; owner_id: string; lead_id: string | null; name: string; email: string; notes: string | null; start_at: string; end_at: string; status: "confirmed" | "cancelled" | "completed"; created_at: string };

export const MAILBOX_PRESETS = {
  gmail: { label: "Gmail / Google Workspace", smtp_host: "smtp.gmail.com", smtp_port: 465, smtp_secure: true, imap_host: "imap.gmail.com", imap_port: 993, help: "Turn on 2-Step Verification, then create an App Password at myaccount.google.com/apppasswords and paste it below." },
  outlook: { label: "Outlook / Microsoft 365", smtp_host: "smtp.office365.com", smtp_port: 587, smtp_secure: false, imap_host: "outlook.office365.com", imap_port: 993, help: "Use your email and password (or an app password if your account has MFA). Your admin may need to allow SMTP AUTH." },
  zoho: { label: "Zoho Mail", smtp_host: "smtp.zoho.com", smtp_port: 465, smtp_secure: true, imap_host: "imap.zoho.com", imap_port: 993, help: "Enable IMAP in Zoho Mail settings; use an app-specific password if 2FA is on." },
  custom: { label: "Other (SMTP + IMAP)", smtp_host: "", smtp_port: 465, smtp_secure: true, imap_host: "", imap_port: 993, help: "Get the SMTP and IMAP settings from your email host (GoDaddy, Hostinger, cPanel, etc.)." },
} as const;
