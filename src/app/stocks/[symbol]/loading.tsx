export default function StockLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
