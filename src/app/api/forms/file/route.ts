import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { signedFileUrl } from "@/lib/forms-submit";

export const dynamic = "force-dynamic";

/** Uploaded files are private: signed-in teammates get a 10-minute link (access checked by the database rules). */
export async function GET(req: Request) {
  await requireUser();
  const q = new URL(req.url).searchParams;
  const sub = q.get("sub") ?? "", key = q.get("key") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(sub)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data } = await supabaseServer().from("lead_submissions").select("files").eq("id", sub).maybeSingle();
  const file = ((data?.files ?? []) as { key: string; path: string }[]).find((f) => f.key === key);
  const url = file ? await signedFileUrl(file.path, 600) : null;
  return url ? NextResponse.redirect(url, 302) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
