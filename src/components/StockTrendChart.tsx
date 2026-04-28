"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendSeriesPoint = Record<string, number | string | null>;

export function StockTrendChart(props: {
  title: string;
  data: TrendSeriesPoint[];
  lines: Array<{ key: string; name: string; stroke: string }>;
}) {
  const hasAnyValue = props.data.some((point) =>
    props.lines.some((l) => typeof point[l.key] === "number"),
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {props.title}
      </div>
      <div className="mt-3 h-56">
        {hasAnyValue ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={props.data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              {props.lines.map((l) => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.name}
                  stroke={l.stroke}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Insufficient data
          </div>
        )}
      </div>
    </div>
  );
}

