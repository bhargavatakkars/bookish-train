import Link from "next/link";

export function EmptyState(props: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {props.title}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {props.body}
      </p>
      {props.ctaHref && props.ctaLabel ? (
        <Link
          href={props.ctaHref}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {props.ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

