import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function formatDurationShort(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export function formatTime(date: Date | string | null | undefined, timezone: string = "Asia/Kolkata"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-IN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date | string | null | undefined, timezone: string = "Asia/Kolkata"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined, timezone: string = "Asia/Kolkata"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function getDateInTimezone(timezone: string = "Asia/Kolkata"): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD format
}

export function getStartOfDayUTC(dateStr: string, timezone: string = "Asia/Kolkata"): Date {
  // dateStr is YYYY-MM-DD in the given timezone
  // Returns UTC Date for start of that day in the timezone
  const d = new Date(`${dateStr}T00:00:00`);
  const offset = getTimezoneOffset(timezone, d);
  return new Date(d.getTime() - offset);
}

export function getEndOfDayUTC(dateStr: string, timezone: string = "Asia/Kolkata"): Date {
  const d = new Date(`${dateStr}T23:59:59.999`);
  const offset = getTimezoneOffset(timezone, d);
  return new Date(d.getTime() - offset);
}

function getTimezoneOffset(timezone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return utcDate.getTime() - tzDate.getTime();
}

export function secondsBetween(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
}

export function parseDate(input: string): string | null {
  const lower = input.trim().toLowerCase();
  const tz = process.env.TIMEZONE || "Asia/Kolkata";

  if (lower === "today") {
    return getDateInTimezone(tz);
  }
  if (lower === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-CA", { timeZone: tz });
  }

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(input + "T00:00:00Z");
    if (!isNaN(d.getTime())) return input;
  }

  return null;
}
