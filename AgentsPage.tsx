"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Edit, UserCheck, UserX, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Agent {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Agent | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form state
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    password: "",
    role: "agent",
  });

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAdd = async () => {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || "Failed to add agent", "error");
        return;
      }
      showMsg("Agent added successfully!", "success");
      setShowAdd(false);
      setForm({ employeeId: "", name: "", email: "", password: "", role: "agent" });
      fetchAgents();
    } catch {
      showMsg("Connection error", "error");
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !agent.active, reason: `${agent.active ? "Deactivated" : "Activated"} by admin` }),
      });
      if (res.ok) {
        showMsg(`Agent ${agent.active ? "deactivated" : "activated"} successfully`, "success");
        fetchAgents();
      }
    } catch {}
  };

  const handleEdit = async () => {
    if (!showEdit) return;
    try {
      const res = await fetch(`/api/agents/${showEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: showEdit.name,
          email: showEdit.email,
          role: showEdit.role,
          reason: "Updated by admin",
        }),
      });
      if (res.ok) {
        showMsg("Agent updated successfully!", "success");
        setShowEdit(null);
        fetchAgents();
      }
    } catch {}
  };

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    team_leader: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    agent: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Agent Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage team members and their access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAgents}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Agent
          </button>
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{agents.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{agents.filter((a) => a.active).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Inactive</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{agents.filter((a) => !a.active).length}</p>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Employee</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{agent.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{agent.employeeId}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{agent.email}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${roleColors[agent.role] || roleColors.agent}`}>
                      {agent.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      agent.active
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {agent.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowEdit({ ...agent })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(agent)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          agent.active
                            ? "hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500"
                            : "hover:bg-green-50 dark:hover:bg-green-900/30 text-green-500"
                        }`}
                        title={agent.active ? "Deactivate" : "Activate"}
                      >
                        {agent.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">No agents found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Agent Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Agent">
        <div className="space-y-4">
          {[
            { label: "Employee ID", key: "employeeId", type: "text", placeholder: "EMP001" },
            { label: "Full Name", key: "name", type: "text", placeholder: "John Doe" },
            { label: "Email", key: "email", type: "email", placeholder: "john@company.com" },
            { label: "Password", key: "password", type: "password", placeholder: "••••••••" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="agent">Agent</option>
              <option value="team_leader">Team Leader</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
              Cancel
            </button>
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              Add Agent
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Agent Modal */}
      {showEdit && (
        <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Agent">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={showEdit.name}
                onChange={(e) => setShowEdit({ ...showEdit, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={showEdit.email}
                onChange={(e) => setShowEdit({ ...showEdit, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
              <select
                value={showEdit.role}
                onChange={(e) => setShowEdit({ ...showEdit, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="agent">Agent</option>
                <option value="team_leader">Team Leader</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowEdit(null)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                Cancel
              </button>
              <button onClick={handleEdit} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
