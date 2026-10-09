"use client";
import { useState, useEffect, useCallback } from "react";
import { formatDurationShort, formatDuration, formatTime, getDateInTimezone } from "@/lib/utils";
import { Calendar, Clock, Coffee, BarChart3 } from "lucide-react";

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

interface MyReport {
  date: string;
  stats: {
    availableSeconds: number;
    breakSeconds: number;
    sessionSeconds: number;
    breakCount: number;
    sessionCount: number;
    isIncomplete: boolean;
  };
  events: Array<{ id: number; status: string; timestamp: string; source: string }>;
  breaks: Array<{ id: number; breakStart: string; breakEnd: string | null; durationSeconds: number | null }>;
}

export default function MyReportsPage() {
  const [date, setDate] = useState(getDateInTimezone(TIMEZONE));
  const [data, setData] = useState<MyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/me/report?date=${d}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport(date);
  }, [date, fetchReport]);

  const presets = [
    { label: "Today", value: getDateInTimezone(TIMEZONE) },
    {
      label: "Yesterday",
      value: (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      })(),
    },
  ];

  const firstLogin = data?.events.find((e) => e.status === "logged_in");
  const lastLogout = data?.events ? [...data.events].reverse().find((e) => e.status === "logged_out") : null;

  const statusConfig: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    logged_in: { emoji: "🟢", label: "Logged In", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
    break: { emoji: "☕", label: "Break Started", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
    back: { emoji: "🔵", label: "Back from Break", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
    logged_out: { emoji: "🔴", label: "Logged Out", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          My Availability Report
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">View your personal attendance data</p>
      </div>

      {/* Date Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Date:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setDate(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  date === p.value
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading report...</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "🟢 Available", value: formatDurationShort(data?.stats.availableSeconds || 0), color: "text-green-700 dark:text-green-400" },
              { label: "☕ Break", value: formatDurationShort(data?.stats.breakSeconds || 0), color: "text-amber-700 dark:text-amber-400" },
              { label: "⏱️ Session", value: formatDurationShort(data?.stats.sessionSeconds || 0), color: "text-blue-700 dark:text-blue-400" },
              { label: "🔄 Sessions", value: `${data?.stats.sessionCount || 0}`, color: "text-slate-700 dark:text-slate-300" },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{card.label}</p>
                <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Login/Logout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Login Time</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                {firstLogin ? formatTime(firstLogin.timestamp, TIMEZONE) : "—"}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Logout Time</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                {lastLogout ? formatTime(lastLogout.timestamp, TIMEZONE) : "—"}
              </p>
            </div>
          </div>

          {/* Incomplete warning */}
          {data?.stats.isIncomplete && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-amber-800 dark:text-amber-400 font-medium">⚠️ Incomplete Session</p>
              <p className="text-amber-700 dark:text-amber-500 text-sm mt-1">You have an open session without a logout.</p>
            </div>
          )}

          {/* Timeline */}
          {data && data.events.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">📅 Status Timeline</h3>
              <div className="space-y-2">
                {data.events.map((event) => {
                  const cfg = statusConfig[event.status] || { emoji: "⚪", label: event.status, color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800" };
                  return (
                    <div key={event.id} className={`flex items-center gap-3 p-3 rounded-lg ${cfg.bg}`}>
                      <span className="text-xl">{cfg.emoji}</span>
                      <span className={`text-sm font-semibold flex-1 ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{formatTime(event.timestamp, TIMEZONE)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Break History */}
          {data && data.breaks.length > 0 && (
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
                    {data.breaks.map((b, i) => (
                      <tr key={b.id} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{formatTime(b.breakStart, TIMEZONE)}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{b.breakEnd ? formatTime(b.breakEnd, TIMEZONE) : <span className="text-amber-500">Ongoing</span>}</td>
                        <td className="py-2 px-3 font-mono text-amber-600 dark:text-amber-400">{b.durationSeconds ? formatDuration(b.durationSeconds) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-700">
                      <td colSpan={3} className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Total</td>
                      <td className="py-2 px-3 font-mono font-semibold text-amber-600 dark:text-amber-400">{formatDurationShort(data.stats.breakSeconds)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {data && data.events.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400">No activity recorded for this date.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
