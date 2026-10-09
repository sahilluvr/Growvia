export const calls: any[] = [];
export async function submitForm(id: string, data: Record<string, string>, ctx: any) {
  calls.push({ id, data, ctx }); (globalThis as any).__calls = calls;
  if (data._gv_hp) return { ok: true, success: { title: "Thanks!", text: "We'll be in touch." } };
  if (data.name === "fail") return { ok: false, error: "Please fill in “Service”.", status: 400 };
  return { ok: true, success: { title: "Thanks — message sent!", text: "RedBlink will get back to you soon." } };
}
