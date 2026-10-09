"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { formatDuration, formatTime, formatDate, getDateInTimezone } from "@/lib/utils";
import { Clock, LogIn, Coffee, ArrowLeft, LogOut, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";

interface User {
  id: number;
  name: string;
  role: string;
  employeeId: string;
}

interface StatusResponse {
  status: "logged_in" | "break" | "logged_out" | "not_logged_in";
  since: string | null;
  lastEvent: unknown;
}

interface ReportResponse {
  date: string;
  stats: {
    availableSeconds: number;
    breakSeconds: number;
    sessionSeconds: number;
    breakCount: number;
    sessionCount: number;
    isIncomplete: boolean;
  };
  events: Array<{
    id: number;
    status: string;
    timestamp: string;
    source: string;
  }>;
  breaks: Array<{
    id: number;
    breakStart: string;
    breakEnd: string | null;
    durationSeconds: number | null;
  }>;
}

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

export function AgentDashboard({ user }: { user: User }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);
  const [liveSecs, setLiveSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAdmin = user.role === "admin" || user.role === "team_leader";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch("/api/me/report?date=today");
      if (res.ok) setReport(await res.json());
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchReport()]);
    setLoading(false);
  }, [fetchStatus, fetchReport]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Live timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (status?.since) {
      const updateTimer = () => {
        const sinceDate = new Date(status.since!);
        const diff = Math.floor((Date.now() - sinceDate.getTime()) / 1000);
        setLiveSecs(Math.max(0, diff));
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const showMessage = (text: string, type: "success" | "error" | "warning") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || "Action failed", "error");
        return;
      }

      // Show success messages
      const now = new Date().toLocaleTimeString("en-IN", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: true });
      switch (action) {
        case "logged_in":
          showMessage(`🟢 Logged In successfully at ${now}`, "success");
          break;
        case "break":
          showMessage(`☕ Break started at ${now}`, "success");
          break;
        case "back":
          showMessage(`🔵 Welcome back! Break ended at ${now}`, "success");
          break;
        case "logged_out":
          showMessage(`🔴 Logged out successfully at ${now}`, "success");
          break;
      }

      await refresh();
    } catch {
      showMessage("Connection error. Please try again.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const currentStatus = status?.status || "not_logged_in";
  const stats = report?.stats;

  const getGreeting = () => {
    const hour = new Date().toLocaleString("en-IN", { timeZone: TIMEZONE, hour: "numeric", hour12: false });
    const h = parseInt(hour);
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const statusConfig = {
    logged_in: { label: "AVAILABLE", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", dot: "bg-green-500", border: "border-green-200 dark:border-green-800" },
    break: { label: "ON BREAK", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", dot: "bg-amber-500", border: "border-amber-200 dark:border-amber-800" },
    logged_out: { label: "LOGGED OUT", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", dot: "bg-red-500", border: "border-red-200 dark:border-red-800" },
    not_logged_in: { label: "NOT LOGGED IN", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800", dot: "bg-slate-400", border: "border-slate-200 dark:border-slate-700" },
  };

  const cfg = statusConfig[currentStatus] || statusConfig.not_logged_in;

  const buttons = [
    {
      action: "logged_in",
      label: "Logged In",
      emoji: "🟢",
      color: "bg-green-500 hover:bg-green-600 active:bg-green-700",
      disabled: currentStatus === "logged_in" || currentStatus === "break",
      description: "Start your shift"
    },
    {
      action: "break",
      label: "Break",
      emoji: "☕",
      color: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700",
      disabled: currentStatus !== "logged_in",
      description: "Take a break"
    },
    {
      action: "back",
      label: "Back",
      emoji: "🔵",
      color: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
      disabled: currentStatus !== "break",
      description: "Return from break"
    },
    {
      action: "logged_out",
      label: "Logout",
      emoji: "🔴",
      color: "bg-red-500 hover:bg-red-600 active:bg-red-700",
      disabled: currentStatus === "not_logged_in" || currentStatus === "logged_out",
      description: "End your shift"
    },
  ];

  const today = getDateInTimezone(TIMEZONE);
  const firstLogin = report?.events.find(e => e.status === "logged_in");
  const lastLogout = report?.events ? [...report.events].reverse().find(e => e.status === "logged_out") : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {getGreeting()}, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-IN", { timeZone: TIMEZONE, weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/team"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Team View
            </Link>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl border font-medium text-sm ${
          message.type === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400" :
          message.type === "error" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400" :
          "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Current Status Card */}
      <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-6`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current Status</p>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${cfg.dot} animate-pulse`} />
              <span className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</span>
            </div>
            {status?.since && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Since {formatTime(status.since, TIMEZONE)}
              </p>
            )}
          </div>

          {/* Live timer */}
          {(currentStatus === "logged_in" || currentStatus === "break") && (
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {currentStatus === "break" ? "Break Duration" : "Available Since"}
              </p>
              <div className={`text-3xl font-mono font-bold ${cfg.color}`}>
                {formatDuration(liveSecs)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {buttons.map((btn) => (
          <button
            key={btn.action}
            onClick={() => handleAction(btn.action)}
            disabled={btn.disabled || actionLoading !== null}
            className={`${btn.color} text-white rounded-2xl p-5 text-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 font-semibold`}
          >
            <div className="text-3xl mb-2">
              {actionLoading === btn.action ? (
                <div className="flex justify-center">
                  <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : btn.emoji}
            </div>
            <div className="text-base">{btn.label}</div>
            <div className="text-xs opacity-80 mt-0.5">{btn.description}</div>
          </button>
        ))}
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-1">Available</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 font-mono">
            {stats ? formatDuration(stats.availableSeconds) : "00h 00m 00s"}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-1">Break</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {stats ? formatDuration(stats.breakSeconds) : "00h 00m 00s"}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-1">Session</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
            {stats ? formatDuration(stats.sessionSeconds) : "00h 00m 00s"}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-1">Breaks</p>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {stats?.breakCount || 0} <span className="text-sm font-normal">taken</span>
          </p>
        </div>
      </div>

      {/* Login/Logout Times */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <LogIn className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Login Time</span>
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {firstLogin ? formatTime(firstLogin.timestamp, TIMEZONE) : "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <LogOut className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Logout Time</span>
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {lastLogout ? formatTime(lastLogout.timestamp, TIMEZONE) : "—"}
          </p>
        </div>
      </div>

      {/* Status Timeline */}
      {report && report.events.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today&apos;s Timeline
          </h3>
          <div className="space-y-2">
            {report.events.map((event, i) => {
              const config = {
                logged_in: { emoji: "🟢", label: "Logged In", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
                break: { emoji: "☕", label: "Break Started", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
                back: { emoji: "🔵", label: "Back from Break", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
                logged_out: { emoji: "🔴", label: "Logged Out", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
              }[event.status] || { emoji: "⚪", label: event.status, color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800" };

              return (
                <div key={event.id} className={`flex items-center gap-3 p-3 rounded-lg ${config.bg}`}>
                  <span className="text-xl">{config.emoji}</span>
                  <div className="flex-1">
                    <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {formatTime(event.timestamp, TIMEZONE)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Break History */}
      {report && report.breaks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Coffee className="h-4 w-4 text-amber-500" />
            Break History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Start</th>
                  <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">End</th>
                  <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {report.breaks.map((b, i) => (
                  <tr key={b.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{formatTime(b.breakStart, TIMEZONE)}</td>
                    <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{b.breakEnd ? formatTime(b.breakEnd, TIMEZONE) : <span className="text-amber-500 animate-pulse">Ongoing</span>}</td>
                    <td className="py-2 px-3 font-mono text-amber-600 dark:text-amber-400">
                      {b.durationSeconds ? formatDuration(b.durationSeconds) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My Report Link */}
      <div className="flex justify-center pb-4">
        <Link
          href="/reports/my"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          View Historical Reports
        </Link>
      </div>
    </div>
  );
}
