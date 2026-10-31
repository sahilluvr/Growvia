/* "Continue with Google" — a plain link (works even before JavaScript loads), plus readable errors. */
const MESSAGES: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Pick an account to continue, or use your email below.",
  expired: "That Google sign-in took too long or was opened in another tab. Please try again.",
  setup: "Google sign-in isn't switched on yet. Please use your email and password for now.",
  audience: "Google sign-in isn't fully set up yet. Please use your email and password for now.",
  banned: "This account has been deactivated. If you think this is a mistake, contact us.",
  nosignup: "New sign-ups are paused right now. If you already have an account, sign in with your email.",
  dupe: "You already have an account with this Gmail written slightly differently (with or without dots). Sign in with your email and password below — your data is safe.",
  failed: "Google couldn't sign you in just now. Please try again, or use your email below.",
};

export function GoogleButton({ from, next, email, error }: { from: "login" | "signup"; next?: string; email?: string; error?: string }) {
  const q = new URLSearchParams({ from });
  if (next) q.set("next", next);
  if (email) q.set("email", email);
  const msg = error ? MESSAGES[error] ?? MESSAGES.failed : "";
  return (
    <div className="grid gap-4">
      {msg && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{msg}</p>}
      <a href={`/auth/google?${q}`} className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-line bg-white px-6 text-[15px] font-medium text-ink shadow-card transition hover:border-stone-400 active:scale-[0.99]">
        <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
        Continue with Google
      </a>
      <div className="flex items-center gap-3 text-[12px] text-stone-400"><span className="h-px flex-1 bg-line" />or use your email<span className="h-px flex-1 bg-line" /></div>
    </div>
  );
}
