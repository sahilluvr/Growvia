"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-line bg-white p-0 shadow-frame backdrop:bg-ink/50 backdrop:backdrop-blur-sm`}>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-stone-500 hover:bg-mist" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[75dvh] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}
