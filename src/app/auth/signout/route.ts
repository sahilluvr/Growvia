import { NextResponse } from "next/server";
import { repo } from "@/lib/data";

async function handle(req: Request) {
  await repo().signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
export const GET = handle;
export const POST = handle;
