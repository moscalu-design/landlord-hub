"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { ChartMonth } from "@/components/properties/propertyPerformanceData";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-slate-500 capitalize">{entry.name}:</span>
          <span
            className="font-medium ml-auto pl-3"
            style={{ color: entry.name === "profit" && entry.value < 0 ? "#ef4444" : entry.color }}
          >
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function yAxisFormatter(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}k`;
  return `€${value}`;
}

export function PropertyPerformanceChart({ data }: { data: ChartMonth[] }) {
  const hasData = data.some((d) => d.costs > 0 || d.profit !== 0);

  if (!hasData) {
    return (
      <div
        data-testid="property-performance-chart-empty"
        className="bg-white border border-slate-200 rounded-xl px-5 py-8 text-center"
      >
        <p className="text-xs text-slate-400">
          No financial data yet. Add cost entries or occupancies to see performance trends.
        </p>
      </div>
    );
  }

  const hasProfitData = data.some((d) => d.profit !== 0);

  return (
    <div
      data-testid="property-performance-chart"
      className="bg-white border border-slate-200 rounded-xl px-5 pt-4 pb-3"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Financial Performance</h2>
          <p className="text-xs text-slate-400 mt-0.5">Last 12 months</p>
        </div>
        <div data-testid="property-performance-chart-legend" className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
            Costs
          </span>
          {hasProfitData && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              Profit
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart
          data-testid="property-performance-chart-plot"
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            vertical={false}
            stroke="#f1f5f9"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
          <Bar
            dataKey="costs"
            name="costs"
            fill="#fbbf24"
            opacity={0.85}
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
          />
          {hasProfitData && (
            <Line
              type="monotone"
              dataKey="profit"
              name="profit"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
