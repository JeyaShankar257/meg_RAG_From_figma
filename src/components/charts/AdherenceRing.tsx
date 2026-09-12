import { useEffect, useState } from "react";

interface AdherenceRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showScore?: boolean;
  animate?: boolean;
}

function getColor(score: number) {
  if (score >= 85) return "#10b981";
  if (score >= 65) return "#f59e0b";
  return "#e11d48";
}

export default function AdherenceRing({
  score,
  size = 120,
  strokeWidth = 10,
  label = "Adherence",
  showScore = true,
  animate = true,
}: AdherenceRingProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = animate ? (displayScore / 100) * circumference : (score / 100) * circumference;
  const color = getColor(score);

  useEffect(() => {
    if (!animate) return;
    let start: number | null = null;
    const duration = 1000;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const pct = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setDisplayScore(Math.round(eased * score));
      if (elapsed < duration) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [score, animate]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: animate ? "none" : "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {showScore && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-slate-900" style={{ fontSize: size * 0.22 }}>
            {displayScore}
          </span>
          <span className="text-slate-500" style={{ fontSize: size * 0.1 }}>{label}</span>
        </div>
      )}
    </div>
  );
}
