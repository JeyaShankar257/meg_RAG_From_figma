import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SparklinePoint } from "../../lib/types";

interface ScoreTrendChartProps {
  data: SparklinePoint[];
  height?: number;
}

export default function ScoreTrendChart({ data, height = 180 }: ScoreTrendChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [`${v}`, "Adherence Score"]}
        />
        <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} fill="url(#scoreGrad)" dot={{ r: 3, fill: "#0d9488", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#0d9488" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
