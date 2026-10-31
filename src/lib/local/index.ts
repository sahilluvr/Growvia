import { LOCAL_PAGES } from "./pages.generated";
export type { LocalPage } from "../blog/types";

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
/** Local market pages whose publish date has arrived. */
export const liveLocal = () => LOCAL_PAGES.filter((p) => p.published <= todayIST());
export const localBySlug = (slug: string) => liveLocal().find((p) => p.slug === slug);
export const LOCAL_BASE = "/local-marketing";
