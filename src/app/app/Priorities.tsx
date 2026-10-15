"use client";
import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { togglePriorityAction } from "@/app/actions";

type P = { title: string; agent: string; done?: boolean };

export function Priorities({ items }: { items: P[] }) {
  const [list, setListState] = useState(items);
  useEffect(() => setListState(items), [items]);
  const setList = (i: number) => setListState((s) => s.map((p, j) => (j === i ? { ...p, done: !p.done } : p)));
  const [, start] = useTransition();
  const done = list.filter((p) => p.done).length;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[13px] text-stone-500">
        <span>{done} of {list.length} done</span>
        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-lime-500 transition-all" style={{ width: `${(done / list.length) * 100}%` }} /></span>
      </div>
      <ul className="grid gap-1.5">
        {list.map((p, i) => (
          <li key={i}>
            <button
              onClick={() => start(async () => { setList(i); await togglePriorityAction(i); })}
              className="flex w-full items-start gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-line hover:bg-paper"
              aria-pressed={!!p.done}
            >
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${p.done ? "border-ink bg-ink text-lime" : "border-stone-400 bg-white"}`}>
                {p.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={`block text-[14px] ${p.done ? "text-stone-400 line-through" : "text-ink"}`}>{p.title}</span>
                <span className="text-[12px] text-stone-400">{p.agent}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
