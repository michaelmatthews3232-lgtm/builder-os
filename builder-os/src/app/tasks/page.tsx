"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewTaskModal } from "@/components/NewTaskModal";
import type { Project, Task, TaskStatus, BlockedReason, BLOCKER_REASON_CONFIG } from "@/lib/types";
import { BLOCKER_REASON_CONFIG as BLOCKER_CFG } from "@/lib/types";
import { Plus, Trash2, Clock, AlertTriangle, X, Check, DollarSign } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import Link from "next/link";

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "todo", label: "To Do", color: "#6b7280" },
  { status: "in_progress", label: "In Progress", color: "#fbbf24" },
  { status: "done", label: "Done", color: "#34d399" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [view, setView] = useState<"board" | "list" | "blocked">("board");

  const fetchData = async () => {
    const [{ data: tasksData }, { data: projectsData }] = await Promise.all([
      supabase.from("tasks").select("*, project:projects(id, name, status)").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
    ]);
    setTasks((tasksData as Task[]) ?? []);
    setProjects((projectsData as Project[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredTasks = filterProject === "all" ? tasks : tasks.filter((t) => t.project_id === filterProject);
  const blockedTasks = tasks.filter((t) => t.is_blocked);
  const totalUnblockCost = blockedTasks.reduce((s, t) => s + (t.unblock_cost ?? 0), 0);

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchData();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchData();
  };

  const saveBlocker = async (taskId: string, data: { blocked_reason: BlockedReason; unblock_cost: string; blocked_notes: string }) => {
    await supabase.from("tasks").update({
      is_blocked: true,
      blocked_reason: data.blocked_reason,
      unblock_cost: data.unblock_cost ? parseFloat(data.unblock_cost) : null,
      blocked_notes: data.blocked_notes.trim() || null,
    }).eq("id", taskId);
    fetchData();
  };

  const clearBlocker = async (taskId: string) => {
    await supabase.from("tasks").update({ is_blocked: false, blocked_reason: null, unblock_cost: null, blocked_notes: null }).eq("id", taskId);
    fetchData();
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Tasks</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {tasks.filter(t => t.status !== "done").length} open · {tasks.filter(t => t.status === "done").length} done
            {blockedTasks.length > 0 && (
              <span style={{ color: "#fb923c", marginLeft: 8 }}>· {blockedTasks.length} blocked</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
            {(["board", "list", "blocked"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: view === v ? "rgba(255,255,255,0.08)" : "transparent",
                  color: view === v ? (v === "blocked" ? "#fb923c" : "var(--text-primary)") : "var(--text-muted)",
                  border: "none", fontFamily: "'Sora', sans-serif", textTransform: "capitalize",
                }}
              >
                {v === "blocked" ? `Blocked ${blockedTasks.length > 0 ? `(${blockedTasks.length})` : ""}` : v}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} style={{ display: "inline", marginRight: 6 }} />Add Task
          </button>
        </div>
      </div>

      {/* Project Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>PROJECT:</span>
        {[{ id: "all", name: "All" }, ...projects].map((p) => (
          <button
            key={p.id}
            onClick={() => setFilterProject(p.id)}
            style={{
              padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid",
              borderColor: filterProject === p.id ? "var(--border-accent)" : "var(--border)",
              background: filterProject === p.id ? "var(--accent-dim)" : "transparent",
              color: filterProject === p.id ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : view === "blocked" ? (
        /* Blocked view */
        <div>
          {totalUnblockCost > 0 && (
            <div className="card" style={{ padding: "14px 18px", marginBottom: 16, borderColor: "rgba(251,146,60,0.2)", background: "rgba(251,146,60,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
              <DollarSign size={14} style={{ color: "#fb923c" }} />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Total estimated cost to unblock all tasks:
              </span>
              <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: "#fb923c" }}>
                ${totalUnblockCost.toFixed(2)}
              </span>
            </div>
          )}
          {blockedTasks.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              No blocked tasks. Use the board or list view to mark tasks as blocked.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {blockedTasks.map((task) => (
                <TaskListRow key={task.id} task={task} onStatusChange={updateStatus} onDelete={deleteTask} onSaveBlocker={saveBlocker} onClearBlocker={clearBlocker} showBlocker />
              ))}
            </div>
          )}
        </div>
      ) : view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
          {COLUMNS.map(({ status, label, color }) => {
            const colTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{colTasks.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colTasks.map((task) => (
                    <TaskBoardCard key={task.id} task={task} onStatusChange={updateStatus} onDelete={deleteTask} onSaveBlocker={saveBlocker} onClearBlocker={clearBlocker} />
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ padding: "20px 16px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: 8, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredTasks.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No tasks found.</div>
          ) : (
            filteredTasks.map((task) => (
              <TaskListRow key={task.id} task={task} onStatusChange={updateStatus} onDelete={deleteTask} onSaveBlocker={saveBlocker} onClearBlocker={clearBlocker} />
            ))
          )}
        </div>
      )}

      {showModal && (
        <NewTaskModal projects={projects} onClose={() => setShowModal(false)} onCreated={fetchData} />
      )}
    </div>
  );
}

// ── Blocker inline form ───────────────────────────────────────────────────────

function BlockerForm({ task, onSave, onCancel }: {
  task: Task;
  onSave: (data: { blocked_reason: BlockedReason; unblock_cost: string; blocked_notes: string }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<BlockedReason>(task.blocked_reason ?? "other");
  const [cost, setCost] = useState(task.unblock_cost?.toString() ?? "");
  const [notes, setNotes] = useState(task.blocked_notes ?? "");

  return (
    <div style={{ marginTop: 10, padding: "12px 14px", background: "rgba(251,146,60,0.06)", borderRadius: 7, border: "1px solid rgba(251,146,60,0.2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ color: "#fb923c" }}>Blocked because</label>
          <select className="input-base mt-1" style={{ fontSize: 12 }} value={reason} onChange={(e) => setReason(e.target.value as BlockedReason)}>
            {(Object.keys(BLOCKER_CFG) as BlockedReason[]).map((k) => (
              <option key={k} value={k}>{BLOCKER_CFG[k].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ color: "#fb923c" }}>Est. cost to unblock ($)</label>
          <input className="input-base mt-1" style={{ fontSize: 12 }} type="number" min="0" step="0.01" placeholder="0.00 (optional)" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ color: "#fb923c" }}>Notes (optional)</label>
        <input className="input-base mt-1" style={{ fontSize: 12 }} placeholder="e.g. Need to upgrade Expo EAS plan — $29/mo" value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus />
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={onCancel}>Cancel</button>
        <button className="btn-primary" style={{ fontSize: 11, padding: "4px 10px", background: "#fb923c" }} onClick={() => onSave({ blocked_reason: reason, unblock_cost: cost, blocked_notes: notes })}>
          <Check size={11} style={{ display: "inline", marginRight: 4 }} />Mark Blocked
        </button>
      </div>
    </div>
  );
}

function BlockerBadge({ task, onClear, onEdit }: { task: Task; onClear: () => void; onEdit: () => void }) {
  const cfg = task.blocked_reason ? BLOCKER_CFG[task.blocked_reason] : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "4px 8px", background: "rgba(251,146,60,0.08)", borderRadius: 5, border: "1px solid rgba(251,146,60,0.2)" }}>
      <AlertTriangle size={10} style={{ color: "#fb923c", flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "#fb923c", fontWeight: 600 }}>BLOCKED</span>
      {cfg && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— {cfg.label}</span>}
      {task.unblock_cost != null && (
        <span className="font-mono" style={{ fontSize: 11, color: "#34d399", marginLeft: 4 }}>${task.unblock_cost}/mo to fix</span>
      )}
      <button onClick={onEdit} style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}>Edit</button>
      <button onClick={onClear} style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}><X size={10} /></button>
    </div>
  );
}

// ── Board card ────────────────────────────────────────────────────────────────

function TaskBoardCard({ task, onStatusChange, onDelete, onSaveBlocker, onClearBlocker }: {
  task: Task;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
  onSaveBlocker: (id: string, d: { blocked_reason: BlockedReason; unblock_cost: string; blocked_notes: string }) => void;
  onClearBlocker: (id: string) => void;
}) {
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== "done";

  return (
    <div className="card card-hover" style={{
      padding: "12px 14px", opacity: task.status === "done" ? 0.55 : 1,
      borderColor: task.is_blocked ? "rgba(251,146,60,0.3)" : isOverdue ? "rgba(248,113,113,0.18)" : undefined,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.4 }}>{task.title}</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.project && (
          <Link href={`/projects/${task.project_id}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 4, textDecoration: "none", fontFamily: "JetBrains Mono, monospace" }}>
            {task.project.name}
          </Link>
        )}
        <StatusBadge type="priority" value={task.priority} />
        {task.due_date && <span style={{ fontSize: 10, color: isOverdue ? "#f87171" : "var(--text-muted)", marginLeft: "auto" }}>{format(parseISO(task.due_date), "MMM d")}</span>}
      </div>

      {task.is_blocked && !showBlockerForm && (
        <BlockerBadge task={task} onClear={() => onClearBlocker(task.id)} onEdit={() => setShowBlockerForm(true)} />
      )}
      {showBlockerForm && (
        <BlockerForm task={task} onSave={(d) => { onSaveBlocker(task.id, d); setShowBlockerForm(false); }} onCancel={() => setShowBlockerForm(false)} />
      )}

      <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 10, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <div className="flex items-center gap-1">
          {!task.is_blocked && !showBlockerForm && (
            <button onClick={() => setShowBlockerForm(true)} style={{ fontSize: 10, color: "#fb923c", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>
              Block
            </button>
          )}
          <button onClick={() => onDelete(task.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.5 }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

function TaskListRow({ task, onStatusChange, onDelete, onSaveBlocker, onClearBlocker, showBlocker }: {
  task: Task;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
  onSaveBlocker: (id: string, d: { blocked_reason: BlockedReason; unblock_cost: string; blocked_notes: string }) => void;
  onClearBlocker: (id: string) => void;
  showBlocker?: boolean;
}) {
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== "done";

  return (
    <div className="card" style={{
      padding: "11px 16px", opacity: task.status === "done" ? 0.5 : 1,
      borderColor: task.is_blocked ? "rgba(251,146,60,0.25)" : isOverdue ? "rgba(248,113,113,0.15)" : undefined,
    }}>
      <div className="flex items-center gap-3">
        <StatusBadge type="task" value={task.status} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none" }}>
          {task.title}
        </span>
        {task.is_blocked && !showBlocker && (
          <span style={{ fontSize: 10, color: "#fb923c", background: "rgba(251,146,60,0.1)", padding: "1px 7px", borderRadius: 4, fontWeight: 700 }}>BLOCKED</span>
        )}
        {task.project && <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{task.project.name}</span>}
        <StatusBadge type="priority" value={task.priority} />
        {task.due_date && <span style={{ fontSize: 11, color: isOverdue ? "#f87171" : "var(--text-muted)", minWidth: 48, textAlign: "right" }}>{format(parseISO(task.due_date), "MMM d")}</span>}
        <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-secondary)", fontSize: 11, padding: "3px 7px", cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        {!task.is_blocked && !showBlockerForm && (
          <button onClick={() => setShowBlockerForm(true)} style={{ fontSize: 10, color: "#fb923c", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 4, cursor: "pointer", padding: "3px 7px", fontFamily: "'Sora', sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}>
            Block
          </button>
        )}
        <button onClick={() => onDelete(task.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {task.is_blocked && !showBlockerForm && (
        <div style={{ marginTop: 8, marginLeft: 4 }}>
          <BlockerBadge task={task} onClear={() => onClearBlocker(task.id)} onEdit={() => setShowBlockerForm(true)} />
        </div>
      )}
      {showBlockerForm && (
        <div style={{ marginTop: 8 }}>
          <BlockerForm task={task} onSave={(d) => { onSaveBlocker(task.id, d); setShowBlockerForm(false); }} onCancel={() => setShowBlockerForm(false)} />
        </div>
      )}
    </div>
  );
}
