"use client";
import { useEffect, useRef, useState } from "react";

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void }; __gvTs?: Promise<void> } }

function load(src: string) {
  if (window.turnstile) return Promise.resolve();
  window.__gvTs ??= new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("captcha script")); document.head.appendChild(s); });
  return window.__gvTs;
}

/** Cloudflare Turnstile widget. Puts the token in a hidden "captcha" field; resets whenever `resetKey` changes. */
export function Turnstile({ siteKey, script, resetKey, action = "auth" }: { siteKey: string; script: string; resetKey?: unknown; action?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    load(script).then(() => {
      if (dead || !box.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, { sitekey: siteKey, action, theme: "light", callback: (t: string) => { if (input.current) input.current.value = t; }, "expired-callback": () => { if (input.current) input.current.value = ""; }, "error-callback": () => { if (input.current) input.current.value = ""; } });
    }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; if (id.current && window.turnstile) window.turnstile.remove(id.current); };
  }, [siteKey, script, action]);
  useEffect(() => { if (resetKey !== undefined && id.current && window.turnstile) { window.turnstile.reset(id.current); if (input.current) input.current.value = ""; } }, [resetKey]);
  return (
    <div>
      <div ref={box} className="min-h-[65px]" />
      {failed && <p role="alert" className="text-[13px] text-amber-700">The “I&apos;m human” check couldn&apos;t load. Turn off any ad or script blocker for this site, then refresh the page.</p>}
      <input ref={input} type="hidden" name="captcha" />
    </div>
  );
}
