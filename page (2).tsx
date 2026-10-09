"use client";
import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClipboardList, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

interface AuditLog {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  adminName: string | null;
  adminId: number;
  targetUserId: number | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit-logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      } else if (res.status === 403) {
        window.location.href = "/dashboard";
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionColors: Record<string, string> = {
    delete_status_event: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    edit_status_event: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    update_agent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Audit Logs
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Track all admin actions and corrections</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Timestamp</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Admin</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Action</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Reason</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.createdAt, TIMEZONE)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-900 dark:text-white font-medium">{log.adminName || `Admin #${log.adminId}`}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${actionColors[log.action] || "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                      <span className="truncate block">{log.reason || "—"}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {log.targetUserId && <span>Target: User #{log.targetUserId}</span>}
                      {log.oldValue && (
                        <div className="mt-1 bg-slate-50 dark:bg-slate-900 rounded p-1 font-mono text-xs max-w-xs overflow-hidden">
                          <span className="text-red-600 dark:text-red-400">- {log.oldValue.slice(0, 60)}{log.oldValue.length > 60 ? "..." : ""}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
