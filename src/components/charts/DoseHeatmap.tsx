import { useState } from "react";
import type { HeatmapCell } from "../../lib/types";

interface DoseHeatmapProps {
  data: HeatmapCell[];
}

type DisplayStatus = "taken" | "missed" | "none";

const statusColors: Record<DisplayStatus, string> = {
  taken: "#10b981",
  missed: "#e11d48",
  none: "#f1f5f9",
};

const statusLabels: Record<DisplayStatus, string> = {
  taken: "Taken",
  missed: "Missed",
  none: "No dose",
};

function getDisplayStatus(status: HeatmapCell["status"]): DisplayStatus {
  if (status === "taken" || status === "late") return "taken";
  if (status === "missed" || status === "skipped") return "missed";
  return "none";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DoseHeatmap({ data }: DoseHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: HeatmapCell } | null>(null);

  // Group into weeks (7 cells per column)
  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <div className="relative">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) => (
              <div
                key={di}
                className="w-4 h-4 rounded-sm cursor-pointer transition-transform hover:scale-125 hover:z-10 relative"
                style={{ backgroundColor: statusColors[getDisplayStatus(cell.status)] }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ x: rect.left, y: rect.top, cell });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {(["taken", "missed"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: statusColors[s] }} />
            {statusLabels[s]}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x + 20, top: tooltip.y - 10 }}
        >
          <div className="font-medium">{formatDate(tooltip.cell.date)}</div>
          <div className="text-slate-300">{statusLabels[getDisplayStatus(tooltip.cell.status)]}</div>
        </div>
      )}
    </div>
  );
}
