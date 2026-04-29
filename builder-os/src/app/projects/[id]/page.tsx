"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewTaskModal } from "@/components/NewTaskModal";
import { KnowledgeTab } from "@/components/KnowledgeTab";
import type { Project, Task, Contractor, ContractorUpdate, TaskStatus, ProjectStatus } from "@/lib/types";
import {
  ArrowLeft,
  Plus,
  ExternalLink,
  Github,
  Globe,
  Zap,
  Database,
  CreditCard,
  Edit3,
  Check,
  X,
  Trash2,
  UserCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  DollarSign,
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "links" | "contractors" | "vault">("tasks");
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkForm, setLinkForm] = useState<Record<string, string>>({});

  const fetchData = async () => {
    const [{ data: proj }, { data: taskData }, { data: contractorData }] =
      await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("contractors").select("*").eq("project_id", id),
      ]);

    setProject(proj as Project);
    setTasks((taskData as Task[]) ?? []);
    setContractors((contractorData as Contractor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (id) fetchData(); }, [id]);

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchData();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchData();
  };

  const updateProjectStatus = async (status: ProjectStatus) => {
    await supabase.from("projects").update({ status }).eq("id", id);
    fetchData();
  };

  const saveLinks = async () => {
    const updatedLinks = {
      ...project!.external_links,
      stripe_dashboard_url: linkForm.stripe ?? "",
      github_repo_url: linkForm.github ?? "",
      firebase_url: linkForm.firebase ?? "",
      revenuecat_url: linkForm.revenuecat ?? "",
      deployment_url: linkForm.deployment ?? "",
    };
    await supabase.from("projects").update({ external_links: updatedLinks }).eq("id", id);
    setEditingLinks(false);
    fetchData();
  };

  const startEditLinks = () => {
    setLinkForm({
      stripe: project?.external_links?.stripe_dashboard_url ?? "",
      github: project?.external_links?.github_repo_url ?? "",
      firebase: project?.external_links?.firebase_url ?? "",
      revenuecat: project?.external_links?.revenuecat_url ?? "",
      deployment: project?.external_links?.deployment_url ?? "",
    });
    setEditingLinks(true);
  };

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
    );
  }

  if (!project) {
    return (
      <div>
        <p style={{ color: "var(--text-muted)" }}>Project not found.</p>
        <Link href="/projects">Back to projects</Link>
      </div>
    );
  }

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Back nav */}
      <Link
        href="/projects"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={13} /> Back to Projects
      </Link>

      {/* Project Header */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div className="flex items-start justify-between gap-4">
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-3 mb-2">
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>
                {project.name}
              </h1>
              <StatusBadge type="project" value={project.status} />
            </div>
            {project.category && (
              <p className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                {project.category}
              </p>
            )}
            {project.description && (
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 640 }}>
                {project.description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
            <div
              className="font-mono"
              style={{ fontSize: 22, fontWeight: 700, color: project.revenue_monthly > 0 ? "#34d399" : "var(--text-muted)" }}
            >
              ${project.revenue_monthly.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400 }}>/mo</span>
            </div>
            <select
              className="input-base"
              style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
              value={project.status}
              onChange={(e) => updateProjectStatus(e.target.value as ProjectStatus)}
            >
              {(["idea","planned","building","monetizing","scaling","archived"] as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "To Do", count: todoTasks.length, color: "#6b7280" },
          { label: "In Progress", count: inProgressTasks.length, color: "#fbbf24" },
          { label: "Done", count: doneTasks.length, color: "#34d399" },
        ].map(({ label, count, color }) => (
          <div key={label} className="card" style={{ padding: "14px 18px", textAlign: "center" }}>
            <div className="font-mono" style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>
              {count}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex items-center gap-0" style={{ borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          {(["tasks", "links", "contractors", "vault"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab ? "var(--accent)" : "var(--text-secondary)",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
                cursor: "pointer",
                transition: "all 0.12s",
                marginBottom: -1,
                textTransform: "capitalize",
                fontFamily: "'Sora', sans-serif",
              }}
            >
              {tab}
              {tab === "tasks" && (
                <span
                  className="font-mono"
                  style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}
                >
                  {tasks.filter(t => t.status !== "done").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div>
            <div className="flex justify-end mb-4">
              <button className="btn-primary" onClick={() => setShowNewTask(true)}>
                <Plus size={13} style={{ display: "inline", marginRight: 6 }} />
                Add Task
              </button>
            </div>
            {tasks.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                No tasks yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.map((task) => (
                  <TaskDetailRow
                    key={task.id}
                    task={task}
                    onStatusChange={updateTaskStatus}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Links Tab */}
        {activeTab === "links" && (
          <div>
            <div className="flex justify-end mb-4">
              {editingLinks ? (
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => setEditingLinks(false)}>
                    <X size={12} style={{ display: "inline", marginRight: 4 }} />Cancel
                  </button>
                  <button className="btn-primary" onClick={saveLinks}>
                    <Check size={12} style={{ display: "inline", marginRight: 4 }} />Save Links
                  </button>
                </div>
              ) : (
                <button className="btn-ghost" onClick={startEditLinks}>
                  <Edit3 size={12} style={{ display: "inline", marginRight: 6 }} />
                  Edit Links
                </button>
              )}
            </div>
            <div className="card" style={{ padding: "10px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <LinkRow
                  icon={<CreditCard size={13} />}
                  label="Stripe"
                  url={project.external_links?.stripe_dashboard_url}
                  editKey="stripe"
                  editing={editingLinks}
                  formValue={linkForm.stripe ?? ""}
                  onChange={(v) => setLinkForm({ ...linkForm, stripe: v })}
                />
                <LinkRow
                  icon={<Github size={13} />}
                  label="GitHub"
                  url={project.external_links?.github_repo_url}
                  editKey="github"
                  editing={editingLinks}
                  formValue={linkForm.github ?? ""}
                  onChange={(v) => setLinkForm({ ...linkForm, github: v })}
                />
                <LinkRow
                  icon={<Database size={13} />}
                  label="Firebase"
                  url={project.external_links?.firebase_url}
                  editKey="firebase"
                  editing={editingLinks}
                  formValue={linkForm.firebase ?? ""}
                  onChange={(v) => setLinkForm({ ...linkForm, firebase: v })}
                />
                <LinkRow
                  icon={<Zap size={13} />}
                  label="RevenueCat"
                  url={project.external_links?.revenuecat_url}
                  editKey="revenuecat"
                  editing={editingLinks}
                  formValue={linkForm.revenuecat ?? ""}
                  onChange={(v) => setLinkForm({ ...linkForm, revenuecat: v })}
                />
                <LinkRow
                  icon={<Globe size={13} />}
                  label="Deployment"
                  url={project.external_links?.deployment_url}
                  editKey="deployment"
                  editing={editingLinks}
                  formValue={linkForm.deployment ?? ""}
                  onChange={(v) => setLinkForm({ ...linkForm, deployment: v })}
                />
                {(project.external_links?.other_tools ?? []).map((tool, i) => (
                  <a key={i} href={tool.url} target="_blank" rel="noreferrer" className="ext-link">
                    <ExternalLink size={12} />
                    {tool.name}
                    <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.5 }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Contractors Tab */}
        {activeTab === "contractors" && (
          <ContractorsTab projectId={id} contractors={contractors} onUpdate={fetchData} />
        )}

        {/* Vault Tab */}
        {activeTab === "vault" && (
          <KnowledgeTab projectId={id} />
        )}
      </div>

      {showNewTask && (
        <NewTaskModal
          projects={[{ id: project.id, name: project.name }]}
          defaultProjectId={project.id}
          onClose={() => setShowNewTask(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}

function TaskDetailRow({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));

  return (
    <div
      className="card"
      style={{
        padding: "13px 16px",
        opacity: task.status === "done" ? 0.5 : 1,
        borderColor: isOverdue && task.status !== "done" ? "rgba(248,113,113,0.18)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--text-primary)",
                textDecoration: task.status === "done" ? "line-through" : "none",
              }}
            >
              {task.title}
            </span>
            <StatusBadge type="priority" value={task.priority} />
            <StatusBadge type="task" value={task.status} />
          </div>
          {task.description && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 6 }}>
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            {task.assigned_to !== "self" && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                <UserCircle size={11} /> {task.assigned_to}
              </span>
            )}
            {task.due_date && (
              <span
                style={{
                  fontSize: 11,
                  color: isOverdue && task.status !== "done" ? "#f87171" : "var(--text-muted)",
                }}
              >
                Due {format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              borderRadius: 5,
              color: "var(--text-secondary)",
              fontSize: 11,
              padding: "4px 8px",
              cursor: "pointer",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <button
            onClick={() => onDelete(task.id)}
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  url,
  editing,
  formValue,
  onChange,
  editKey: _editKey,
}: {
  icon: React.ReactNode;
  label: string;
  url?: string;
  editing: boolean;
  formValue: string;
  onChange: (v: string) => void;
  editKey: string;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-3" style={{ padding: "8px 4px" }}>
        <div style={{ width: 22, color: "var(--text-muted)", flexShrink: 0 }}>{icon}</div>
        <span style={{ width: 90, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>
          {label}
        </span>
        <input
          className="input-base"
          style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
          placeholder={`https://...`}
          value={formValue}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="ext-link" style={{ opacity: 0.4, cursor: "default" }}>
        {icon}
        <span>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>—</span>
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="ext-link">
      {icon}
      <span>{label}</span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "var(--text-muted)",
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {url.replace("https://", "")}
      </span>
      <ExternalLink size={10} style={{ flexShrink: 0 }} />
    </a>
  );
}

const PLATFORMS = ["Upwork", "Fiverr", "Direct", "Toptal", "LinkedIn", "Other"];

function ContractorsTab({
  projectId,
  contractors,
  onUpdate,
}: {
  projectId: string;
  contractors: Contractor[];
  onUpdate: () => void;
}) {
  const emptyForm = { name: "", role: "", platform: "", hourly_rate: "", email: "", status: "active" };
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updates, setUpdates] = useState<Record<string, ContractorUpdate[]>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [addingNote, setAddingNote] = useState<string | null>(null);

  const fetchUpdates = async (contractorId: string) => {
    const { data } = await supabase
      .from("contractor_updates")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });
    setUpdates((prev) => ({ ...prev, [contractorId]: (data as ContractorUpdate[]) ?? [] }));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!updates[id]) fetchUpdates(id);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("contractors").insert({
      project_id: projectId,
      name: form.name.trim(),
      role: form.role.trim() || null,
      platform: form.platform || null,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      email: form.email.trim() || null,
      status: form.status,
    });
    setSaving(false);
    setAdding(false);
    setForm(emptyForm);
    onUpdate();
  };

  const remove = async (id: string) => {
    await supabase.from("contractors").delete().eq("id", id);
    onUpdate();
  };

  const addNote = async (contractorId: string) => {
    const note = noteInputs[contractorId]?.trim();
    if (!note) return;
    await supabase.from("contractor_updates").insert({
      contractor_id: contractorId,
      project_id: projectId,
      note,
    });
    setNoteInputs((prev) => ({ ...prev, [contractorId]: "" }));
    setAddingNote(null);
    fetchUpdates(contractorId);
  };

  const deleteNote = async (contractorId: string, noteId: string) => {
    await supabase.from("contractor_updates").delete().eq("id", noteId);
    fetchUpdates(contractorId);
  };

  const statusColor = (s: string) =>
    s === "active" ? { bg: "rgba(52,211,153,0.1)", color: "#34d399" } :
    s === "completed" ? { bg: "rgba(99,102,241,0.1)", color: "#818cf8" } :
    { bg: "rgba(107,114,128,0.1)", color: "#6b7280" };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={13} style={{ display: "inline", marginRight: 6 }} />
          Add Contractor
        </button>
      </div>

      {adding && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Name *</label>
              <input className="input-base mt-1" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label>Role</label>
              <input className="input-base mt-1" placeholder="e.g. iOS Dev, Designer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div>
              <label>Platform</label>
              <select className="input-base mt-1" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                <option value="">Select platform...</option>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Hourly Rate ($/hr)</label>
              <input
                className="input-base mt-1"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              />
            </div>
            <div>
              <label>Email</label>
              <input className="input-base mt-1" placeholder="contractor@email.com" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label>Status</label>
              <select className="input-base mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => { setAdding(false); setForm(emptyForm); }}>Cancel</button>
            <button className="btn-primary" onClick={handleAdd} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : "Add Contractor"}
            </button>
          </div>
        </div>
      )}

      {contractors.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          No contractors on this project.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {contractors.map((c) => {
            const sc = statusColor(c.status);
            const isOpen = expanded.has(c.id);
            const contractorUpdates = updates[c.id] ?? [];
            return (
              <div key={c.id} className="card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "13px 16px", cursor: "pointer" }} onClick={() => toggleExpand(c.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                          {c.role && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.role}</span>}
                          {c.platform && (
                            <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                              {c.platform}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {c.email && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.email}</span>}
                          {c.hourly_rate != null && (
                            <span className="font-mono" style={{ fontSize: 11, color: "#34d399", display: "flex", alignItems: "center", gap: 2 }}>
                              <DollarSign size={10} />{c.hourly_rate}/hr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600, fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", background: sc.bg, color: sc.color }}>
                        {c.status}
                      </span>
                      <button onClick={() => remove(c.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", background: "rgba(255,255,255,0.015)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 }}>
                        <MessageSquare size={11} /> Progress Notes
                      </span>
                      {addingNote !== c.id && (
                        <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setAddingNote(c.id)}>
                          <Plus size={11} style={{ display: "inline", marginRight: 4 }} />Add Note
                        </button>
                      )}
                    </div>

                    {addingNote === c.id && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <textarea
                          className="input-base"
                          placeholder="Progress update, deliverable status, blocker, etc."
                          value={noteInputs[c.id] ?? ""}
                          onChange={(e) => setNoteInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          style={{ minHeight: 60, fontSize: 12, flex: 1 }}
                          autoFocus
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button className="btn-primary" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => addNote(c.id)}>Save</button>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => setAddingNote(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {contractorUpdates.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No updates yet. Add a note to track progress.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {contractorUpdates.map((u) => (
                          <div key={u.id} style={{ display: "flex", gap: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{u.note}</p>
                              <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, display: "block" }}>
                                {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <button onClick={() => deleteNote(c.id, u.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, alignSelf: "flex-start" }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
