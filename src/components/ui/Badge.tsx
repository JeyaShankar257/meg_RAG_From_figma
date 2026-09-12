import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline" | "ai";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 border border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  error: "bg-rose-50 text-rose-700 border border-rose-200",
  info: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  outline: "bg-transparent text-teal-700 border border-teal-300",
  ai: "bg-cyan-50 text-cyan-700 border border-cyan-200",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-cyan-500",
  outline: "bg-teal-500",
  ai: "bg-cyan-500",
};

export default function Badge({ children, variant = "default", size = "sm", dot = false, className = "" }: BadgeProps) {
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeClass} ${variantClasses[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
