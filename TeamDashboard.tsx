"use client";
import { useState, useEffect, useCallback } from "react";
import { formatDuration, formatTime, formatDurationShort } from "@/lib/utils";
import { RefreshCw, Users, Search, Filter } from "lucide-react";
import Link from "next/link";

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

interface AgentStatus {
  id: number;
  name: string;
  employeeId: string;
  role: string;
  status: "logged_in" | "break" | "logged_out" | "not_logged_in";
  since: string | null;
  loginTime: string | null;
  openBreakSince: string | null;
  totalAvailableSeconds: number;
  totalBreakSeconds: number;
}

interface TeamStatusResponse {
  teamStatus: AgentStatus[];
  date: string;
}

export function TeamDashboard() {
  const [data, setData] = useState<TeamStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [liveTick, setLiveTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/team/status");
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Live timer tick
  useEffect(() => {
    const t = setInterval(() => setLiveTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const getLiveDuration = (since: string | null, extra: number = 0): number => {
    if (!since) return extra;
    return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000)) + extra;
  };

  const agents = data?.teamStatus || [];
  const filtered = agents.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || a.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    available: agents.filter((a) => a.status === "logged_in").length,
    break: agents.filter((a) => a.status === "break").length,
    loggedOut: agents.filter((a) => a.status === "logged_out" || a.status === "not_logged_in").length,
    total: agents.length,
  };

  const statusConfig = {
    logged_in: { label: "Available", emoji: "🟢", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800", badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    break: { label: "On Break", emoji: "☕", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    logged_out: { label: "Logged Out", emoji: "🔴", color: "text-red-700 dark:text-red-400", bg: "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900", badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    not_logged_in: { label: "Not Logged In", emoji: "⚫", color: "text-slate-500 dark:text-slate-500", bg: "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700", badge: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Live Team Status
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reports"
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            📊 Reports
          </Link>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Agents", value: counts.total, color: "text-slate-700 dark:text-slate-300", bg: "bg-white dark:bg-slate-800" },
          { label: "🟢 Available", value: counts.available, color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "☕ On Break", value: counts.break, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "🔴 Logged Out", value: counts.loggedOut, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl border border-slate-200 dark:border-slate-700 p-4`}>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Status</option>
            <option value="logged_in">🟢 Available</option>
            <option value="break">☕ Break</option>
            <option value="logged_out">🔴 Logged Out</option>
            <option value="not_logged_in">⚫ Not Logged In</option>
          </select>
        </div>
      </div>

      {/* Agent Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agent) => {
            const cfg = statusConfig[agent.status] || statusConfig.not_logged_in;
            const liveDuration = agent.status === "logged_in"
              ? getLiveDuration(agent.since, agent.totalAvailableSeconds)
              : agent.status === "break"
              ? getLiveDuration(agent.openBreakSince)
              : agent.totalAvailableSeconds;

            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className={`block rounded-2xl border-2 ${cfg.bg} p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{agent.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{agent.employeeId}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                </div>

                <div className="space-y-2">
                  {agent.loginTime && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Login</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{formatTime(agent.loginTime, TIMEZONE)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {agent.status === "break" ? "Break Duration" : "Available Today"}
                    </span>
                    <span className={`font-mono font-semibold ${
                      agent.status === "break" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                    }`}>
                      {formatDurationShort(liveDuration)}
                    </span>
                  </div>

                  {agent.status !== "break" && agent.totalBreakSeconds > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Total Break</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">{formatDurationShort(agent.totalBreakSeconds)}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-500 dark:text-slate-400">
              No agents found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
