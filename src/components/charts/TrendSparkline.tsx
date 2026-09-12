import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import type { SparklinePoint } from "../../lib/types";

interface TrendSparklineProps {
  data: SparklinePoint[];
  color?: string;
  height?: number;
  width?: number | string;
}

export default function TrendSparkline({ data, color = "#0d9488", height = 40, width = "100%" }: TrendSparklineProps) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#fff" }}
          itemStyle={{ color: "#fff" }}
          formatter={(v: number) => [`${v}`, "Score"]}
          labelFormatter={() => ""}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
