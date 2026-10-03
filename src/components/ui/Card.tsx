import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
  style?: CSSProperties;
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export default function Card({ children, className = "", hover = false, onClick, padding = "md", style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`
        bg-white rounded-xl border border-slate-200 shadow-sm
        ${hover ? "card-hover cursor-pointer" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-slate-900 ${className}`}>{children}</h3>;
}
