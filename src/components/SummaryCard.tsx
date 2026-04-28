export function SummaryCard(props: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {props.title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {props.value}
      </div>
      {props.subtitle ? (
        <div className="mt-1 text-xs text-zinc-500">{props.subtitle}</div>
      ) : null}
    </div>
  );
}

