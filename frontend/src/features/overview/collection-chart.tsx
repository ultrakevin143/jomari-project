"use client";

import { type Overview } from "@/features/overview/types";
import { number } from "@/shared/lib/utils";

export function CollectionChart({
  series: dailySeries,
}: {
  series: Overview["series"];
}) {
  const stride = Math.max(1, Math.ceil(dailySeries.length / 7));
  const series = Array.from(
    { length: Math.ceil(dailySeries.length / stride) },
    (_, index) => {
      const days = dailySeries.slice(index * stride, (index + 1) * stride);
      return {
        date: days[0]!.date,
        endDate: days.at(-1)!.date,
        scheduled: days.reduce((n, d) => n + d.scheduled, 0),
        completed: days.reduce((n, d) => n + d.completed, 0),
        missed: days.reduce((n, d) => n + d.missed, 0),
      };
    },
  );
  const max = Math.max(1, ...series.map((d) => d.scheduled)),
    top = Math.ceil(max / 500) * 500,
    width = 640,
    height = 215,
    left = 80,
    bottom = 28,
    plot = height - bottom - 14,
    slot = (width - left - 12) / Math.max(series.length, 1);
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="legend-scheduled" />
          Scheduled stops
        </span>
        <span>
          <i className="legend-completed" />
          Completed stops
        </span>
      </div>
      <div className="chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Scheduled and completed collection stops across the reporting period"
        >
          <title>
            Scheduled versus completed stops by reporting interval. Exact totals
            are available in the chart description and operations report.
          </title>
          <desc>
            {series
              .map(
                (d) =>
                  `${d.date}${d.date === d.endDate ? "" : ` to ${d.endDate}`}: ${d.scheduled} scheduled, ${d.completed} completed, ${d.missed} missed.`,
              )
              .join(" ")}
          </desc>
          {[0, 0.5, 1].map((n) => (
            <g key={n}>
              <line
                x1={left}
                x2={width - 8}
                y1={14 + plot * (1 - n)}
                y2={14 + plot * (1 - n)}
                className="chart-grid"
              />
              <text
                x={left - 10}
                y={18 + plot * (1 - n)}
                textAnchor="end"
                className="chart-label"
              >
                {number(top * n)}
              </text>
            </g>
          ))}
          {series.map((d, i) => {
            const x = left + slot * i + slot * 0.2,
              bw = Math.max(4, slot * 0.22);
            return (
              <g key={d.date}>
                <title>{`${d.date}${d.date === d.endDate ? "" : ` to ${d.endDate}`}: ${d.completed}/${d.scheduled} completed; ${d.missed} missed`}</title>
                <rect
                  className="bar-scheduled"
                  x={x}
                  y={14 + plot * (1 - d.scheduled / top)}
                  width={bw}
                  height={(plot * d.scheduled) / top}
                  rx="2"
                />
                <rect
                  className="bar-completed"
                  x={x + bw + 4}
                  y={14 + plot * (1 - d.completed / top)}
                  width={bw}
                  height={(plot * d.completed) / top}
                  rx="2"
                />
                <text
                  x={x + bw + 2}
                  y={height - 7}
                  textAnchor="middle"
                  className="chart-label"
                >
                  {i % Math.ceil(series.length / 14) === 0
                    ? new Date(`${d.date}T00:00:00Z`).toLocaleDateString(
                        "en-PH",
                        {
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        },
                      )
                    : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}
