import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-[18px] border border-gray-200 bg-white p-5 shadow-soft ${className}`} {...props} />;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "light" | "danger" }) {
  const styles = {
    primary: "bg-gray-900 text-white hover:bg-gray-800",
    secondary: "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
    light: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
  }[variant];
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Pill({ children, tone = "indigo" }: { children: ReactNode; tone?: "indigo" | "green" | "amber" | "blue" | "gray" }) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    gray: "bg-gray-100 text-gray-600",
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles}`}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-800">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-4 text-gray-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100";
