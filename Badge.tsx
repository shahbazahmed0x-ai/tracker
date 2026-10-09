import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "green" | "yellow" | "red" | "blue" | "gray" | "orange";
  className?: string;
}

const variants = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config = {
    logged_in: { label: "🟢 Available", variant: "green" as const },
    break: { label: "☕ Break", variant: "yellow" as const },
    logged_out: { label: "🔴 Logged Out", variant: "red" as const },
    not_logged_in: { label: "⚫ Not Logged In", variant: "gray" as const },
  }[status] || { label: status, variant: "gray" as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
