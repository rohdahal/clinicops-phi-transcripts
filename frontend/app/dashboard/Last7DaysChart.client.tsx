"use client";

import { useMemo, useState } from "react";

type Point = {
  day: string;
  count: number;
};

type Props = {
  viewed: Point[];
  processed: Point[];
};

const shortDay = (value: string) => value.slice(5);

export default function Last7DaysChart({ viewed, processed }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const rows = useMemo(() => {
    return viewed.map((item, index) => ({
      day: item.day,
      viewed: item.count,
      processed: processed[index]?.count ?? 0
    }));
  }, [processed, viewed]);

  const maxValue = Math.max(
    1,
    ...rows.map((item) => Math.max(item.viewed, item.processed))
  );

  const chartHeight = 120;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-700" />
            Viewed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
            Processed
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {rows.map((item, index) => {
          const viewedHeight = Math.max(2, Math.round((item.viewed / maxValue) * chartHeight));
          const processedHeight = Math.max(2, Math.round((item.processed / maxValue) * chartHeight));
          return (
            <div
              key={item.day}
              className="relative flex flex-col items-center gap-2"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {activeIndex === index ? (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 shadow-sm">
                  <p>{item.day}</p>
                  <p>Viewed: {item.viewed}</p>
                  <p>Processed: {item.processed}</p>
                </div>
              ) : null}
              <div className="flex h-[120px] items-end gap-1">
                <div
                  className="w-2.5 rounded-sm bg-slate-700"
                  style={{ height: `${viewedHeight}px` }}
                />
                <div
                  className="w-2.5 rounded-sm bg-slate-400"
                  style={{ height: `${processedHeight}px` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{shortDay(item.day)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
