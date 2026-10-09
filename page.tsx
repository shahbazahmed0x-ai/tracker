"use client";
import { useState, useEffect, useCallback, use, Suspense } from "react";
import { formatDurationShort, formatDuration, formatTime, getDateInTimezone } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Coffee, Trash2 } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";

interface AgentReport {
  agent: { id: number; name: string; employeeId: string };
  date: string;
  events: Array<{ id: number; status: string; timestamp: string; source: string }>;
  stats: {
    availableSeconds: number;
    breakSeconds: number;
    sessionSeconds: number;
    breakCount: number;
    sessionCount: number;
    isIncomplete: boolean;
  };
  breaks: Array<{ id: number; breakStart: string; breakEnd: string | null; durationSeconds: number | null }>;
}

function AgentDetailContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || getDateInTimezone(TIMEZONE));
  const [data, setData] = useState<AgentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ eventId: number; status: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchReport = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${id}/report?date=${d}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchReport(date);
  }, [date, fetchReport]);

  const handleDelete = async () => {
    if (!deleteModal || !deleteReason.trim()) return;
    try {
      const res = await fetch("/api/status/edit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: deleteModal.eventId, reason: deleteReason }),
      });
      if (res.ok) {
        setMessage({ text: "Event deleted and audit logged.", type: "success" });
        setDeleteModal(null);
        setDeleteReason("");
        fetchReport(date);
      } else {
        const d = await res.json();
        setMessage({ text: d.error || "Failed to delete", type: "error" });
      }
    } catch {
      setMessage({ text: "Error deleting event", type: "error" });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const statusConfig: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
    logged_in: { emoji: "🟢", label: "Logged In", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
    break: { emoji: "☕", label: "Break Started", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
    back: { emoji: "🔵", label: "Back from Break", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
    logged_out: { emoji: "🔴", label: "Logged Out", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  };

  const firstLogin = data?.events.find((e) => e.status === "logged_in");
  const lastLogout = data?.events ? [...data.events].reverse().find((e) => e.status === "logged_out") : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/team" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {data?.agent.name || "Agent Details"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{data?.agent.employeeId}</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl border text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Date Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Date:</span>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading...</div>
      ) : data ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "🟢 Available", value: formatDurationShort(data.stats.availableSeconds), color: "text-green-700 dark:text-green-400" },
              { label: "☕ Break", value: formatDurationShort(data.stats.breakSeconds), color: "text-amber-700 dark:text-amber-400" },
              { label: "⏱️ Session", value: formatDurationShort(data.stats.sessionSeconds), color: "text-blue-700 dark:text-blue-400" },
              { label: "🔄 Sessions", value: `${data.stats.sessionCount}`, color: "text-slate-700 dark:text-slate-300" },
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Login</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{firstLogin ? formatTime(firstLogin.timestamp, TIMEZONE) : "—"}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Logout</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{lastLogout ? formatTime(lastLogout.timestamp, TIMEZONE) : "—"}</p>
            </div>
          </div>

          {/* Incomplete warning */}
          {data.stats.isIncomplete && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-amber-800 dark:text-amber-400 font-medium">⚠️ Incomplete Session</p>
              <p className="text-amber-700 dark:text-amber-500 text-sm mt-1">Agent has an open session without a logout.</p>
            </div>
          )}

          {/* Status Timeline */}
          {data.events.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">📅 Status Timeline</h3>
              <div className="space-y-2">
                {data.events.map((event) => {
                  const cfg = statusConfig[event.status] || { emoji: "⚪", label: event.status, color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800" };
                  return (
                    <div key={event.id} className={`flex items-center gap-3 p-3 rounded-lg ${cfg.bg}`}>
                      <span className="text-xl">{cfg.emoji}</span>
                      <span className={`text-sm font-semibold flex-1 ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-slate-500 dark:text-slate-400">{event.source}</span>
                      <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{formatTime(event.timestamp, TIMEZONE)}</span>
                      <button
                        onClick={() => setDeleteModal({ eventId: event.id, status: event.status })}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors"
                        title="Delete event (admin correction)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                ℹ️ Deleting an event recalculates all times. All changes are audit-logged.
              </p>
            </div>
          )}

          {/* Break History */}
          {data.breaks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Coffee className="h-4 w-4 text-amber-500" />
                Break History
              </h3>
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
              </table>
            </div>
          )}

          {data.events.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400">No activity recorded for this date.</p>
            </div>
          )}
        </>
      ) : null}

      {/* Delete Event Modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Status Event">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You are about to delete the <strong className="text-slate-900 dark:text-white">{deleteModal?.status}</strong> event. This action is logged and can be reviewed in audit logs.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for deletion <span className="text-red-500">*</span>
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Explain why this event is being removed..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!deleteReason.trim()}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Event
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-500">Loading...</div>}>
      <AgentDetailContent id={id} />
    </Suspense>
  );
}
