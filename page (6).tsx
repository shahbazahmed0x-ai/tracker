"use client";
import { useState } from "react";
import { Settings, Lock, User, Info } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: "New passwords do not match", type: "error" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: "Password must be at least 6 characters", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "Password changed successfully!", type: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ text: data.error || "Failed to change password", type: "error" });
      }
    } catch {
      setMessage({ text: "Connection error", type: "error" });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your account settings</p>
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

      {/* Change Password */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-600" />
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {[
            { label: "Current Password", value: currentPassword, setter: setCurrentPassword },
            { label: "New Password", value: newPassword, setter: setNewPassword },
            { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{field.label}</label>
              <input
                type="password"
                value={field.value}
                onChange={(e) => field.setter(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="••••••••"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {loading ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* About */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          About AgentTrack
        </h2>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p><strong className="text-slate-900 dark:text-white">System:</strong> Agent Availability & Break Tracking</p>
          <p><strong className="text-slate-900 dark:text-white">Timezone:</strong> {process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata"}</p>
          <p><strong className="text-slate-900 dark:text-white">Version:</strong> 1.0.0</p>
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Status Flow:</p>
            <p>🟢 Logged In → ☕ Break → 🔵 Back → 🔴 Logout</p>
            <p>All calculations are timestamp-based and stored in UTC.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
