import "server-only";
import { waitUntil as vercelWaitUntil } from "@vercel/functions";

/** Where the app is running: Vercel (serverless) or Google Cloud Run (container, sets K_SERVICE). */
export const onVercel = Boolean(process.env.VERCEL);
export const onCloudRun = Boolean(process.env.K_SERVICE);
export const isProductionHost = onVercel || onCloudRun;
export const deployId = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.K_REVISION || "local").slice(0, 12);
export const hostRegion = process.env.VERCEL_REGION || process.env.CLOUD_RUN_REGION || (onCloudRun ? "cloud-run" : "local");

/**
 * Finish small work after replying. Vercel keeps the function alive for it; on Cloud Run the CPU is only
 * guaranteed while a request is open, so there we simply wait for it (keep such work short — use jobs for slow work).
 */
export async function afterReply(p: Promise<unknown>): Promise<void> {
  const safe = p.catch(() => null);
  if (onVercel) { vercelWaitUntil(safe); return; }
  await safe;
}
