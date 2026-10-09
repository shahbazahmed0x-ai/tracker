"use client";
import { useState, useEffect, useCallback } from "react";
import { formatDurationShort, formatTime, getDateInTimezone } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Download, Calendar, RefreshCw, BarChart3 } from "lucide-react";
import Link from "next/link";

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

interface AgentReport {
  id: number;
  name: string;
  employeeId: string;
  role: string;
  stats: {
    availableSeconds: number;
    breakSeconds: number;
    sessionSeconds: number;
    breakCount: number;
    sessionCount: number;
    isIncomplete: boolean;
  };
  loginTime: string | null;
  logoutTime: string | null;
  hasActivity: boolean;
}

interface TeamReport {
  date: string;
  agents: AgentReport[];
  summary: {
    totalAgents: number;
    activeAgents: number;
    completedAgents: number;
    totalAvailableSeconds: number;
    totalBreakSeconds: number;
    totalSessionSeconds: number;
  };
}

export function ReportsPage() {
  const [date, setDate] = useState(getDateInTimezone(TIMEZONE));
  const [data, setData] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/report?date=${d}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport(date);
  }, [date, fetchReport]);

  const handleExport = () => {
    window.open(`/api/export?date=${date}`, "_blank");
  };

  const activeAgents = data?.agents.filter((a) => a.hasActivity) || [];
  const chartData = activeAgents
    .sort((a, b) => b.stats.availableSeconds - a.stats.availableSeconds)
    .map((a) => ({
      name: a.name.split(" ")[0],
      available: Math.round(a.stats.availableSeconds / 3600 * 100) / 100,
      break: Math.round(a.stats.breakSeconds / 3600 * 100) / 100,
    }));

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Daily Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">View team availability for any date</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
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

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Agents", value: data.summary.totalAgents, color: "text-slate-700 dark:text-slate-300" },
            { label: "Active Today", value: data.summary.activeAgents, color: "text-blue-700 dark:text-blue-400" },
            { label: "Completed", value: data.summary.completedAgents, color: "text-green-700 dark:text-green-400" },
            { label: "Total Available", value: formatDurationShort(data.summary.totalAvailableSeconds), color: "text-green-700 dark:text-green-400" },
            { label: "Total Break", value: formatDurationShort(data.summary.totalBreakSeconds), color: "text-amber-700 dark:text-amber-400" },
            { label: "Total Session", value: formatDurationShort(data.summary.totalSessionSeconds), color: "text-blue-700 dark:text-blue-400" },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{card.label}</p>
              <p className={`text-lg font-bold font-mono ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Available Time by Agent (hours)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, color: "#f1f5f9" }}
                formatter={(value, name) => [`${value}h`, name === "available" ? "Available" : "Break"]}
              />
              <Bar dataKey="available" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="break" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-sm bg-green-500" /> Available
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-3 h-3 rounded-sm bg-amber-500" /> Break
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            📋 Agent Report — {new Date(date + "T12:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading report...
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Agent</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Login</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Logout</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Available</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Break</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Session</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Breaks</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Sessions</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{agent.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{agent.employeeId}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {agent.loginTime ? formatTime(agent.loginTime, TIMEZONE) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {agent.logoutTime ? formatTime(agent.logoutTime, TIMEZONE) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-green-700 dark:text-green-400 font-semibold">
                      {agent.hasActivity ? formatDurationShort(agent.stats.availableSeconds) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-700 dark:text-amber-400">
                      {agent.hasActivity ? formatDurationShort(agent.stats.breakSeconds) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-400">
                      {agent.hasActivity ? formatDurationShort(agent.stats.sessionSeconds) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                      {agent.hasActivity ? agent.stats.breakCount : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                      {agent.hasActivity ? agent.stats.sessionCount : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!agent.hasActivity ? (
                        <span className="text-xs text-slate-400">No activity</span>
                      ) : agent.stats.isIncomplete ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⚠️ Incomplete</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✅ Complete</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/agents/${agent.id}?date=${date}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.agents.length === 0) && (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                No data available for this date.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
