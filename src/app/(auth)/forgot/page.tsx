import type { Metadata } from "next";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Reset your Growvia password", description: "Forgot your password? Enter your email and we will send you a link to choose a new one.", robots: { index: false, follow: true }, alternates: { canonical: "/forgot" } };
import { TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY, captchaOn } from "@/lib/captcha";

export const dynamic = "force-dynamic"; // captcha settings come from env at request time

export default function ForgotPage() {
  return <ForgotForm captcha={captchaOn ? { siteKey: TURNSTILE_SITE_KEY, script: TURNSTILE_SCRIPT } : null} />;
}
