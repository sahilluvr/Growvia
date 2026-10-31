"use client";
/*
  Wraps a server action so a dropped connection, a timeout or a just-shipped deploy shows a friendly
  message in the form instead of crashing the whole page ("Application error: a client-side exception").
  Redirects and notFound() from the action still work as normal.
*/
import { isRedirectError } from "next/dist/client/components/redirect";
import { isNotFoundError } from "next/dist/client/components/not-found";

export function friendlyActionError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/Failed to find Server Action|older or newer deployment/i.test(msg)) return "Growvia was just updated. Please refresh the page and try again.";
  if (e instanceof TypeError || /NetworkError|Failed to fetch|Load failed|network/i.test(msg)) return "Your connection dropped before Growvia could reply. Check your internet and try again — nothing was lost.";
  if (/unexpected response|timed? ?out|504|502/i.test(msg)) return "That took longer than expected. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

export const rethrowIfNavigation = (e: unknown) => { if (isRedirectError(e) || isNotFoundError(e)) throw e; };

// Same input → same wrapper, so useFormState always sees a stable action.
const cache = new WeakMap<object, unknown>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safe<A extends (state: any, payload: any) => Promise<any>>(action: A): A {
  const hit = cache.get(action);
  if (hit) return hit as A;
  const wrapped = (async (state: unknown, payload: unknown) => {
    try {
      return await action(state, payload);
    } catch (e) {
      rethrowIfNavigation(e);
      console.error(e);
      return { error: friendlyActionError(e) };
    }
  }) as A;
  cache.set(action, wrapped);
  return wrapped;
}
