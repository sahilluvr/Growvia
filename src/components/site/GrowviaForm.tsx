"use client";
import { useEffect, useRef } from "react";

/** Growvia's own lead form on our marketing site (Forms → "Website form" in the Growvia workspace). */
export const SITE_FORM_ID = "ca31c8da-840f-47f5-b63a-9c9de31e7e67";

/**
 * Same snippet customers paste on their sites. React doesn't run <script> tags written in JSX,
 * so it's added after mount; embed.js puts the auto-sizing form right after it.
 */
export function GrowviaForm({ id = SITE_FORM_ID }: { id?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    const s = document.createElement("script");
    s.src = "/embed.js";
    s.async = true;
    s.setAttribute("data-growvia-form", id);
    el.appendChild(s);
    return () => { el.innerHTML = ""; };
  }, [id]);
  return (
    <div ref={box} className="min-h-[420px]" data-testid="growvia-form">
      <noscript>Please enable JavaScript to use this form, or email us instead.</noscript>
    </div>
  );
}
