import { Check, Minus } from "lucide-react";
import { Words } from "./motion";
import { Reveal } from "./Reveal";

const COLS = ["AI writing tools", "SEO tools", "Schedulers", "CRMs", "Growvia"];
const ROWS: [string, boolean[]][] = [
  ["Builds a growth plan for your business", [false, false, false, false, true]],
  ["Writes emails, posts and images", [true, false, false, false, true]],
  ["Publishes and schedules to social", [false, false, true, false, true]],
  ["Audits your site & tracks Google rankings", [false, true, false, false, true]],
  ["Tracks AI-search visibility (ChatGPT, Gemini…)", [false, false, false, false, true]],
  ["Captures leads from your website & WhatsApp", [false, false, false, true, true]],
  ["Follows up automatically until they reply", [false, false, false, true, true]],
  ["One inbox for email, WhatsApp & DMs", [false, false, false, false, true]],
];

export function Compare() {
  return (
    <section className="border-y border-line bg-white py-24 sm:py-32">
      <div className="container-x">
        <Reveal className="max-w-3xl">
          <span className="eyebrow">Why Growvia</span>
          <h2 className="h-section mt-5">
            <Words text="Other tools help you create." /><br />
            <span className="relative isolate inline-block">
              <Words text="Growvia helps you grow." delay={260} />
              <span className="line-grow absolute inset-x-0 bottom-1 -z-10 h-3 bg-lime/70 sm:h-4" />
            </span>
          </h2>
        </Reveal>

        <Reveal className="mt-14 hidden overflow-hidden rounded-2xl border border-line md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-paper">
                <th className="p-4 text-[13px] font-medium text-stone-500 sm:p-5">What you actually need</th>
                {COLS.map((c, i) => (
                  <th
                    key={c}
                    className={`p-4 text-center text-[13px] font-medium sm:p-5 ${i === COLS.length - 1 ? "bg-ink text-lime" : "text-stone-500"}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, vals]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="p-4 text-[15px] sm:p-5">{label}</td>
                  {vals.map((v, i) => {
                    const last = i === vals.length - 1;
                    return (
                      <td key={i} className={`p-4 text-center sm:p-5 ${last ? "bg-ink" : ""}`}>
                        {v ? (
                          <span className={`check-pop inline-grid h-6 w-6 place-items-center rounded-full ${last ? "bg-lime text-ink" : "bg-mist text-stone-600"}`} style={{ animationDelay: `${200 + i * 60}ms` }}>
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            <span className="sr-only">Yes</span>
                          </span>
                        ) : (
                          <span className="inline-grid h-6 w-6 place-items-center text-stone-300">
                            <Minus className="h-4 w-4" />
                            <span className="sr-only">No</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        {/* mobile */}
        <Reveal className="mt-10 grid gap-2 md:hidden">
          {ROWS.map(([label, vals]) => {
            const others = COLS.slice(0, -1).filter((_, i) => vals[i]);
            return (
              <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper p-4">
                <div>
                  <div className="text-[15px] font-medium">{label}</div>
                  <div className="mt-0.5 text-[13px] text-stone-500">{others.length ? `Also: ${others.join(", ")}` : "Not covered by typical tools"}</div>
                </div>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-lime" aria-label="Growvia: yes">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </div>
            );
          })}
        </Reveal>
        <p className="mt-4 text-[13px] text-stone-400">Typical capabilities by category — some tools in each category do more.</p>
      </div>
    </section>
  );
}
