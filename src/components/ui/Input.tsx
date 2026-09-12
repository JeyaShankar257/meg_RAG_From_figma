import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export default function Input({ label, error, hint, icon, iconRight, fullWidth = true, className = "", id, ...rest }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={`${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        )}
        <input
          id={inputId}
          {...rest}
          className={`
            w-full bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${error ? "border-rose-400 focus:ring-rose-400" : "border-slate-200 hover:border-slate-300"}
            ${icon ? "pl-10" : "pl-3"} ${iconRight ? "pr-10" : "pr-3"} py-2.5
            ${className}
          `}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{iconRight}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = "", id, ...rest }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...rest}
        className={`
          w-full bg-white border rounded-lg text-sm text-slate-900 px-3 py-2.5
          transition-all duration-150 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
          ${error ? "border-rose-400" : "border-slate-200 hover:border-slate-300"}
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = "", id, ...rest }: TextareaProps) {
  const textId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={textId}
        {...rest}
        className={`
          w-full bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 px-3 py-2.5
          transition-all duration-150 resize-none
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
          ${error ? "border-rose-400" : "border-slate-200 hover:border-slate-300"}
          ${className}
        `}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
