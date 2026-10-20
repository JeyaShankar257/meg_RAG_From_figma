import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  variant?: "light" | "dark";
}

export default function Input({
  label,
  error,
  hint,
  icon,
  iconRight,
  fullWidth = true,
  variant,
  className = "",
  id,
  ...rest
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const isDark =
    variant === "dark" ||
    className.includes("bg-slate") ||
    className.includes("bg-gray");

  return (
    <div className={`${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium mb-1.5 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          {...rest}
          className={`
            w-full rounded-lg text-sm transition-all duration-150
            focus:outline-none focus:ring-2 focus:border-transparent
            disabled:cursor-not-allowed border
            ${
              isDark
                ? "bg-slate-800 border-slate-700 hover:border-slate-600 text-white placeholder-slate-400 placeholder:text-slate-400 focus:ring-indigo-500 disabled:bg-slate-900 disabled:text-slate-600"
                : "bg-white border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 placeholder:text-slate-400 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
            }
            ${error ? "border-rose-400 focus:ring-rose-400" : ""}
            ${icon ? "pl-10" : "pl-3"} ${iconRight ? "pr-10" : "pr-3"} py-2.5
            ${className}
          `}
        />
        {iconRight && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {iconRight}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      {hint && !error && (
        <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  variant?: "light" | "dark";
}

export function Select({
  label,
  error,
  options,
  variant,
  className = "",
  id,
  ...rest
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const isDark =
    variant === "dark" ||
    className.includes("bg-slate") ||
    className.includes("bg-gray");
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className={`block text-sm font-medium mb-1.5 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...rest}
        className={`
          w-full rounded-lg text-sm px-3 py-2.5
          transition-all duration-150 cursor-pointer border
          focus:outline-none focus:ring-2 focus:border-transparent
          ${
            isDark
              ? "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-100 focus:ring-indigo-500"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-900 focus:ring-teal-500"
          }
          ${error ? "border-rose-400" : ""}
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: "light" | "dark";
}

export function Textarea({
  label,
  error,
  hint,
  variant,
  className = "",
  id,
  ...rest
}: TextareaProps) {
  const textId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const isDark =
    variant === "dark" ||
    className.includes("bg-slate") ||
    className.includes("bg-gray");
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textId}
          className={`block text-sm font-medium mb-1.5 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          {label}
        </label>
      )}
      <textarea
        id={textId}
        {...rest}
        className={`
          w-full rounded-lg text-sm px-3 py-2.5
          transition-all duration-150 resize-none border
          focus:outline-none focus:ring-2 focus:border-transparent
          ${
            isDark
              ? "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-100 placeholder-slate-400 placeholder:text-slate-400 focus:ring-indigo-500"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 placeholder:text-slate-400 focus:ring-teal-500"
          }
          ${error ? "border-rose-400" : ""}
          ${className}
        `}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {hint && !error && (
        <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
