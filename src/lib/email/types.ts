export type Mailbox = {
  business_id?: string | null; // project this address sends for (v056)
  id: string; owner_id: string; label: string; from_name: string; from_email: string;
  smtp_host: string; smtp_port: number; smtp_secure: boolean; imap_host: string | null; imap_port: number;
  username: string; password_enc: string; daily_limit: number; signature: string | null;
  status: "connected" | "error"; last_error: string | null; imap_last_uid: number; imap_uidvalidity: number | null;
  last_sync_at: string | null; created_at: string;
};
export type Template = { id: string; owner_id: string; name: string; category: string; subject: string; body: string; created_at: string; updated_at: string };
export type Sequence = {
  id: string; owner_id: string; name: string; status: "draft" | "active" | "paused" | "completed"; mailbox_id: string | null;
  stop_on_reply: boolean; send_days: number[]; send_start: number; send_end: number; timezone: string; created_at: string; kind?: "campaign" | "broadcast";
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

type Preset = {
  label: string; smtp_host: string; smtp_port: number; smtp_secure: boolean; imap_host: string; imap_port: number;
  /** Short plain-English steps; `link` opens the exact page where the password is made. */
  help: string; steps: string[]; link?: { label: string; url: string }; password: string; dailyLimit: number;
};
const PRESETS = {
  gmail: { label: "Gmail / Google Workspace", smtp_host: "smtp.gmail.com", smtp_port: 465, smtp_secure: true, imap_host: "imap.gmail.com", imap_port: 993, password: "App password", dailyLimit: 100,
    help: "Google needs a special 16-letter “app password” (your normal password won't work).",
    steps: ["Make sure 2-Step Verification is on for this Google account.", "Click “Create app password”, type Growvia as the name and press Create.", "Copy the 16 letters Google shows and paste them below."],
    link: { label: "Create app password", url: "https://myaccount.google.com/apppasswords" } },
  outlook: { label: "Microsoft 365 / Outlook (business)", smtp_host: "smtp.office365.com", smtp_port: 587, smtp_secure: false, imap_host: "outlook.office365.com", imap_port: 993, password: "Password or app password", dailyLimit: 200,
    help: "Works with Microsoft 365 business mailboxes. Personal Outlook.com / Hotmail addresses no longer allow other apps to sign in with a password.",
    steps: ["Use your email and password — or an app password if you sign in with a code.", "If it's refused, ask whoever manages your Microsoft 365 to turn on “Authenticated SMTP” for this mailbox (Microsoft 365 admin → Users → Mail → Manage email apps)."],
    link: { label: "Create app password", url: "https://mysignins.microsoft.com/security-info" } },
  zoho: { label: "Zoho Mail", smtp_host: "smtp.zoho.com", smtp_port: 465, smtp_secure: true, imap_host: "imap.zoho.com", imap_port: 993, password: "Password or app password", dailyLimit: 200,
    help: "Use your Zoho password, or an app-specific password if two-factor sign-in is on.",
    steps: ["In Zoho Mail: Settings → Mail Accounts → IMAP → tick “IMAP Access”.", "If you use two-factor sign-in, create an app-specific password and paste it below."],
    link: { label: "Create app password", url: "https://accounts.zoho.com/home#security/app_password" } },
  zoho_in: { label: "Zoho Mail (India)", smtp_host: "smtp.zoho.in", smtp_port: 465, smtp_secure: true, imap_host: "imap.zoho.in", imap_port: 993, password: "Password or app password", dailyLimit: 200,
    help: "For Zoho accounts created in India (zoho.in).",
    steps: ["In Zoho Mail: Settings → Mail Accounts → IMAP → tick “IMAP Access”.", "If you use two-factor sign-in, create an app-specific password and paste it below."],
    link: { label: "Create app password", url: "https://accounts.zoho.in/home#security/app_password" } },
  yahoo: { label: "Yahoo Mail", smtp_host: "smtp.mail.yahoo.com", smtp_port: 465, smtp_secure: true, imap_host: "imap.mail.yahoo.com", imap_port: 993, password: "App password", dailyLimit: 100,
    help: "Yahoo needs an app password.",
    steps: ["Open Yahoo Account Security → “Generate app password”.", "Name it Growvia, copy the password and paste it below."],
    link: { label: "Create app password", url: "https://login.yahoo.com/account/security" } },
  icloud: { label: "iCloud Mail", smtp_host: "smtp.mail.me.com", smtp_port: 587, smtp_secure: false, imap_host: "imap.mail.me.com", imap_port: 993, password: "App-specific password", dailyLimit: 100,
    help: "Apple needs an app-specific password.",
    steps: ["Sign in at account.apple.com → Sign-In and Security → App-Specific Passwords.", "Create one called Growvia and paste it below."],
    link: { label: "Create app password", url: "https://account.apple.com/account/manage" } },
  godaddy: { label: "GoDaddy email", smtp_host: "smtpout.secureserver.net", smtp_port: 465, smtp_secure: true, imap_host: "imap.secureserver.net", imap_port: 993, password: "Email password", dailyLimit: 200,
    help: "For GoDaddy “Professional Email”. If your GoDaddy email is Microsoft 365, choose Microsoft 365 instead.",
    steps: ["Use the same email and password you use to log in to GoDaddy webmail."] },
  hostinger: { label: "Hostinger email", smtp_host: "smtp.hostinger.com", smtp_port: 465, smtp_secure: true, imap_host: "imap.hostinger.com", imap_port: 993, password: "Email password", dailyLimit: 200,
    help: "For email bought with Hostinger.", steps: ["Use the same email and password you use for Hostinger webmail."] },
  titan: { label: "Titan email", smtp_host: "smtp.titan.email", smtp_port: 465, smtp_secure: true, imap_host: "imap.titan.email", imap_port: 993, password: "Email password", dailyLimit: 200,
    help: "Titan is often included with domains from Hostinger, Namecheap and others.", steps: ["Use the same email and password you use for Titan webmail."] },
  namecheap: { label: "Namecheap Private Email", smtp_host: "mail.privateemail.com", smtp_port: 465, smtp_secure: true, imap_host: "mail.privateemail.com", imap_port: 993, password: "Email password", dailyLimit: 200,
    help: "For Namecheap's Private Email.", steps: ["Use the same email and password you use for Private Email webmail."] },
  custom: { label: "Other", smtp_host: "", smtp_port: 465, smtp_secure: true, imap_host: "", imap_port: 993, password: "Password", dailyLimit: 200,
    help: "Your email host shows its “SMTP” and “IMAP” settings in its help pages or control panel (cPanel → Email Accounts → Connect Devices).",
    steps: ["Search “<your host> SMTP settings” — copy the server names into the boxes below.", "Port 465 with SSL works for most hosts."] },
};
export type MailboxPresetKey = keyof typeof PRESETS;
export const MAILBOX_PRESETS: Record<MailboxPresetKey, Preset> = PRESETS;
