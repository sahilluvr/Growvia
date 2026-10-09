import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared social-share card for the marketing pages. */
export async function ogCard(title: string, sub: string, tag = "Your AI growth team") {
  const dir = path.join(process.cwd(), "src/lib/social/fonts");
  const [r, b] = await Promise.all([readFile(path.join(dir, "Geist-Regular.ttf")), readFile(path.join(dir, "Geist-Black.ttf"))]).catch(() => [null, null]);
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0B0D0C", color: "#fff", fontFamily: r ? "Geist" : undefined, position: "relative" }}>
        <div style={{ position: "absolute", right: -160, top: -160, width: 560, height: 560, borderRadius: 560, background: "#C5F23A", opacity: 0.22, display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#C5F23A", display: "flex", alignItems: "center", justifyContent: "center", color: "#0B0D0C", fontSize: 30, fontWeight: 800 }}>G</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>growvia</div>
          <div style={{ display: "flex", marginLeft: 16, fontSize: 20, color: "#C5F23A", textTransform: "uppercase", letterSpacing: 3 }}>{tag}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: title.length > 48 ? 60 : 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, maxWidth: 1000 }}>{title}</div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 28, lineHeight: 1.35, color: "rgba(255,255,255,0.65)", maxWidth: 980 }}>{sub}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, ...(r && b ? { fonts: [{ name: "Geist", data: r, weight: 400 as const, style: "normal" as const }, { name: "Geist", data: b, weight: 800 as const, style: "normal" as const }] } : {}) },
  );
}
