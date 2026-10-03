// Billing settings. Plans & prices live in ./catalog (safe to use in the browser too).
export * from "./catalog";
import type { Currency } from "./catalog";

// Server-side settings (Vercel → Environment Variables).
const env = (k: string) => (process.env[k] ?? "").trim();
export const RZP = {
  keyId: env("RAZORPAY_KEY_ID"),
  keySecret: env("RAZORPAY_KEY_SECRET"),
  webhookSecret: env("RAZORPAY_WEBHOOK_SECRET"),
  api: (env("RAZORPAY_API_BASE") || "https://api.razorpay.com").replace(/\/$/, ""),
  checkoutJs: env("RAZORPAY_CHECKOUT_JS") || "https://checkout.razorpay.com/v1/checkout.js",
};
export const billingReady = () => Boolean(RZP.keyId && RZP.keySecret);

/**
 * Which currencies the card can be charged in. Razorpay always supports INR; USD needs "international payments"
 * switched on for your Razorpay account. Default: both (USD fails gracefully with a clear message if not enabled).
 */
export const CHARGE_CURRENCIES: Currency[] = (() => {
  const v = env("BILLING_CURRENCIES").toUpperCase().split(/[\s,]+/).filter((c): c is Currency => c === "USD" || c === "INR");
  return v.length ? v : ["USD", "INR"];
})();

/** Accounts that get Pro free (you, your own clients). Comma-separated emails. */
export const COMP_EMAILS = env("BILLING_FREE_PRO_EMAILS").toLowerCase().split(/[\s,]+/).filter(Boolean);

/**
 * PayPal through Razorpay (one-time "prepaid" months/years for customers abroad — Razorpay can't renew PayPal
 * automatically). Turn on with PAYPAL_PREPAID=on once PayPal is linked in Razorpay → Settings → PayPal.
 */
export const prepaidReady = () => /^(1|on|true|yes)$/i.test(env("PAYPAL_PREPAID")) && billingReady();
