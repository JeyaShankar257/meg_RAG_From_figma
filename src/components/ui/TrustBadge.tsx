interface TrustBadgeProps {
  score: number;
  trend?: "up" | "down" | "stable";
  size?: "sm" | "md" | "lg";
}

function getScoreConfig(score: number) {
  if (score >= 85) return { label: "High Trust", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", ring: "#10b981" };
  if (score >= 65) return { label: "Moderate", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", ring: "#f59e0b" };
  return { label: "Needs Support", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", ring: "#e11d48" };
}

export default function TrustBadge({ score, trend, size = "md" }: TrustBadgeProps) {
  const cfg = getScoreConfig(score);
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : size === "lg" ? "text-base px-4 py-2 gap-2" : "text-sm px-3 py-1 gap-1.5";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-slate-500";

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${sizeClass} ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className="font-mono font-bold">{score}</span>
      <span className="font-normal opacity-70">/ 100</span>
      <span className="opacity-50 mx-0.5">·</span>
      <span className="font-medium">{cfg.label}</span>
      {trend && <span className={`font-bold ${trendColor}`}>{trendIcon}</span>}
    </span>
  );
}
