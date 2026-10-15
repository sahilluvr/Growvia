"use client";
/** Last-resort fallback if the root layout itself fails. Plain styles: global CSS may not be loaded here. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F7F7F3", color: "#0B0D0C", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something interrupted Growvia</h1>
          <p style={{ color: "#6E736D", fontSize: 14, lineHeight: 1.6 }}>Usually a dropped connection or a fresh update. Your data is safe.</p>
          <button onClick={() => (reset(), location.reload())} style={{ marginTop: 12, background: "#0B0D0C", color: "#fff", border: 0, borderRadius: 999, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
