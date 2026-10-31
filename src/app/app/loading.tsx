// Shown instantly while a page's data loads, so navigation never feels stuck.
export default function Loading() {
  const bar = "animate-pulse rounded-lg bg-mist";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={`${bar} h-9 w-64`} />
      <div className={`${bar} mt-3 h-4 w-96 max-w-full`} />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} mt-3 h-7 w-16`} />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card h-64 p-6"><div className={`${bar} h-4 w-40`} /><div className={`${bar} mt-6 h-40 w-full`} /></div>
        <div className="card h-64 p-6"><div className={`${bar} h-4 w-32`} />{[0, 1, 2, 3].map((i) => <div key={i} className={`${bar} mt-4 h-5 w-full`} />)}</div>
      </div>
    </div>
  );
}
