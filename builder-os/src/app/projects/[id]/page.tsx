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
  Loader2,
  GitCommit,
  AlertCircle,
  Sparkles,
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<{ title: string; description: string | null; priority: "high" | "medium" | "low" }[]>([]);
  const [selectedGenTasks, setSelectedGenTasks] = useState<Set<number>>(new Set());
  const [addingGenTasks, setAddingGenTasks] = useState(false);

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

  const deleteProject = async () => {
    setDeleting(true);
    // Delete related records first, then the project
    await supabase.from("contractor_updates").delete().in(
      "contractor_id",
      (await supabase.from("contractors").select("id").eq("project_id", id)).data?.map((c: { id: string }) => c.id) ?? []
    );
    await Promise.all([
      supabase.from("contractors").delete().eq("project_id", id),
      supabase.from("tasks").delete().eq("project_id", id),
      supabase.from("project_knowledge").delete().eq("project_id", id),
      supabase.from("plan_items").delete().eq("project_id", id),
    ]);
    await supabase.from("projects").delete().eq("id", id);
    router.push("/projects");
  };

  const generateTasksForProject = async () => {
    if (!project) return;
    setGeneratingTasks(true);
    try {
      const res = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          description: project.description,
          status: project.status,
          existingTasks: tasks.map((t) => t.title),
        }),
      });
      const { tasks: newTasks } = await res.json();
      if (newTasks?.length) {
        setGeneratedTasks(newTasks);
        setSelectedGenTasks(new Set(newTasks.map((_: unknown, i: number) => i)));
      }
    } catch { /* silently fail */ }
    setGeneratingTasks(false);
  };

  const addGeneratedTasks = async () => {
    if (!generatedTasks.length) return;
    setAddingGenTasks(true);
    const toInsert = generatedTasks
      .filter((_, i) => selectedGenTasks.has(i))
      .map((t) => ({
        project_id: id,
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        status: "todo",
        assigned_to: "self",
      }));
    if (toInsert.length) {
      await supabase.from("tasks").insert(toInsert);
    }
    setGeneratedTasks([]);
    setSelectedGenTasks(new Set());
    setAddingGenTasks(false);
    fetchData();
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
            <div className="flex items-center gap-2">
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
              {!confirmDelete ? (
                <button
                  className="btn-ghost"
                  onClick={() => setConfirmDelete(true)}
                  style={{ padding: "6px 8px", color: "#f87171" }}
                  title="Delete project"
                >
                  <Trash2 size={13} />
                </button>
              ) : (
                <div className="flex items-center gap-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 7, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#f87171" }}>Delete project?</span>
                  <button
                    onClick={deleteProject}
                    disabled={deleting}
                    style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}
                  >
                    {deleting ? "Deleting..." : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 2 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
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
            <div className="flex items-center justify-between mb-4">
              <button
                className="btn-ghost"
                onClick={generatedTasks.length ? () => { setGeneratedTasks([]); setSelectedGenTasks(new Set()); } : generateTasksForProject}
                disabled={generatingTasks}
                style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              >
                {generatingTasks
                  ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  : <Sparkles size={12} />}
                {generatingTasks ? "Generating..." : generatedTasks.length ? "Clear AI Tasks" : "Generate with AI"}
              </button>
              <button className="btn-primary" onClick={() => setShowNewTask(true)}>
                <Plus size={13} style={{ display: "inline", marginRight: 6 }} />
                Add Task
              </button>
            </div>

            {/* AI-generated task picker */}
            {generatedTasks.length > 0 && (
              <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.04)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} style={{ color: "var(--accent)" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>AI-Suggested Tasks</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{selectedGenTasks.size} selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => {
                        if (selectedGenTasks.size === generatedTasks.length) {
                          setSelectedGenTasks(new Set());
                        } else {
                          setSelectedGenTasks(new Set(generatedTasks.map((_, i) => i)));
                        }
                      }}
                    >
                      {selectedGenTasks.size === generatedTasks.length ? "Deselect All" : "Select All"}
                    </button>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 11, padding: "5px 12px" }}
                      onClick={addGeneratedTasks}
                      disabled={addingGenTasks || selectedGenTasks.size === 0}
                    >
                      {addingGenTasks ? "Adding..." : `Add ${selectedGenTasks.size} Task${selectedGenTasks.size !== 1 ? "s" : ""}`}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {generatedTasks.map((t, i) => {
                    const selected = selectedGenTasks.has(i);
                    const priorityColor = t.priority === "high" ? "#f87171" : t.priority === "medium" ? "#fbbf24" : "#6b7280";
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedGenTasks((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        })}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "10px 12px", borderRadius: 7, cursor: "pointer",
                          background: selected ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${selected ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
                          transition: "all 0.1s",
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                          background: selected ? "var(--accent)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {selected && <Check size={10} color="#fff" strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{t.title}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: priorityColor, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "JetBrains Mono, monospace" }}>
                              {t.priority}
                            </span>
                          </div>
                          {t.description && (
                            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4, margin: "3px 0 0" }}>
                              {t.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tasks.length === 0 && generatedTasks.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                No tasks yet. Add one or let AI generate some.
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
          <KnowledgeTab projectId={id} projectName={project.name} />
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

interface ContractorPayment {
  id: string;
  contractor_id: string;
  project_id: string;
  amount: number;
  paid_date: string;
  notes: string | null;
  created_at: string;
}

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
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "notes" | "payments">>({});
  const [updates, setUpdates] = useState<Record<string, ContractorUpdate[]>>({});
  const [payments, setPayments] = useState<Record<string, ContractorPayment[]>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [addingNote, setAddingNote] = useState<string | null>(null);
  const [addingPayment, setAddingPayment] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paid_date: new Date().toISOString().split("T")[0], notes: "" });

  const fetchUpdates = async (contractorId: string) => {
    const { data } = await supabase
      .from("contractor_updates")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false });
    setUpdates((prev) => ({ ...prev, [contractorId]: (data as ContractorUpdate[]) ?? [] }));
  };

  const fetchPayments = async (contractorId: string) => {
    const { data } = await supabase
      .from("contractor_payments")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("paid_date", { ascending: false });
    setPayments((prev) => ({ ...prev, [contractorId]: (data as ContractorPayment[]) ?? [] }));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!updates[id]) fetchUpdates(id);
        if (!payments[id]) fetchPayments(id);
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
    await supabase.from("contractor_updates").insert({ contractor_id: contractorId, project_id: projectId, note });
    setNoteInputs((prev) => ({ ...prev, [contractorId]: "" }));
    setAddingNote(null);
    fetchUpdates(contractorId);
  };

  const deleteNote = async (contractorId: string, noteId: string) => {
    await supabase.from("contractor_updates").delete().eq("id", noteId);
    fetchUpdates(contractorId);
  };

  const addPayment = async (contractorId: string) => {
    if (!paymentForm.amount) return;
    await supabase.from("contractor_payments").insert({
      contractor_id: contractorId,
      project_id: projectId,
      amount: parseFloat(paymentForm.amount),
      paid_date: paymentForm.paid_date,
      notes: paymentForm.notes.trim() || null,
    });
    setPaymentForm({ amount: "", paid_date: new Date().toISOString().split("T")[0], notes: "" });
    setAddingPayment(null);
    fetchPayments(contractorId);
  };

  const deletePayment = async (contractorId: string, paymentId: string) => {
    await supabase.from("contractor_payments").delete().eq("id", paymentId);
    fetchPayments(contractorId);
  };

  const totalPaid = (contractorId: string) =>
    (payments[contractorId] ?? []).reduce((s, p) => s + p.amount, 0);

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
              <input className="input-base mt-1" placeholder="0.00" type="number" min="0" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
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
            const subTab = activeSubTab[c.id] ?? "notes";
            const contractorUpdates = updates[c.id] ?? [];
            const contractorPayments = payments[c.id] ?? [];
            const paid = totalPaid(c.id);
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
                            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 2 }}>
                              ${c.hourly_rate}/hr
                            </span>
                          )}
                          {paid > 0 && (
                            <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: "#f87171", display: "flex", alignItems: "center", gap: 2 }}>
                              <DollarSign size={10} />{paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid
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
                  <div style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.015)" }}>
                    {/* Sub-tabs */}
                    <div className="flex" style={{ borderBottom: "1px solid var(--border)", padding: "0 16px" }}>
                      {(["notes", "payments"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveSubTab((prev) => ({ ...prev, [c.id]: tab }))}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: "8px 12px", background: "none", border: "none",
                            borderBottom: `2px solid ${subTab === tab ? "var(--accent)" : "transparent"}`,
                            color: subTab === tab ? "var(--accent)" : "var(--text-muted)",
                            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
                            marginBottom: -1,
                          }}
                        >
                          {tab === "payments"
                            ? `Payments${paid > 0 ? ` · $${paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}`
                            : "Notes"}
                        </button>
                      ))}
                    </div>

                    <div style={{ padding: "14px 16px" }}>
                      {subTab === "notes" && (
                        <>
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
                            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No updates yet.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {contractorUpdates.map((u) => (
                                <div key={u.id} style={{ display: "flex", gap: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>{u.note}</p>
                                    <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, display: "block" }}>
                                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                  </div>
                                  <button onClick={() => deleteNote(c.id, u.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {subTab === "payments" && (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5 }}>
                              <DollarSign size={11} /> Payment History
                            </span>
                            {addingPayment !== c.id && (
                              <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setAddingPayment(c.id)}>
                                <Plus size={11} style={{ display: "inline", marginRight: 4 }} />Log Payment
                              </button>
                            )}
                          </div>

                          {addingPayment === c.id && (
                            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                <div>
                                  <label>Amount ($) *</label>
                                  <input
                                    className="input-base mt-1"
                                    type="number" min="0" step="0.01" placeholder="0.00"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label>Date *</label>
                                  <input
                                    className="input-base mt-1"
                                    type="date"
                                    value={paymentForm.paid_date}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paid_date: e.target.value })}
                                  />
                                </div>
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <label>Notes (optional)</label>
                                  <input
                                    className="input-base mt-1"
                                    placeholder="e.g. Milestone 1, logo design, hours 10–14..."
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setAddingPayment(null)}>Cancel</button>
                                <button className="btn-primary" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => addPayment(c.id)} disabled={!paymentForm.amount}>
                                  Log Payment
                                </button>
                              </div>
                            </div>
                          )}

                          {contractorPayments.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No payments logged yet.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {contractorPayments.map((p) => (
                                <div key={p.id} className="flex items-center gap-3" style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                                  <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>
                                    ${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{p.notes ?? ""}</span>
                                  <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                    {new Date(p.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <button onClick={() => deletePayment(c.id, p.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                              <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textAlign: "right" }}>
                                Total: <span className="font-mono" style={{ color: "#f87171" }}>${paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
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

// ── Live Integration Status ───────────────────────────────────────────────────

function LiveIntegrationStatus({ project }: { project: Project }) {
  const githubUrl = project.external_links?.github_repo_url;
  const deployUrl = project.external_links?.deployment_url;

  const [githubData, setGithubData] = useState<Record<string, unknown> | null>(null);
  const [vercelData, setVercelData] = useState<Record<string, unknown> | null>(null);
  const [netlifyData, setNetlifyData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const calls: Promise<void>[] = [];

    if (githubUrl) {
      calls.push(
        fetch("/api/integrations/github", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl: githubUrl }),
        }).then((r) => r.json()).then((d) => { if (!d.error) setGithubData(d); }).catch(() => {})
      );
    }

    if (deployUrl) {
      calls.push(
        fetch("/api/integrations/vercel", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deploymentUrl: deployUrl, projectName: project.name }),
        }).then((r) => r.json()).then((d) => { if (d.matched) setVercelData(d.matched); }).catch(() => {})
      );
      calls.push(
        fetch("/api/integrations/netlify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteUrl: deployUrl, projectName: project.name }),
        }).then((r) => r.json()).then((d) => { if (d.matched) setNetlifyData(d.matched); }).catch(() => {})
      );
    }

    await Promise.all(calls);
    setLoading(false);
    setFetched(true);
  };

  if (!githubUrl && !deployUrl) return null;

  const vercelState = (vercelData as { latest_deployment?: { state: string } } | null)?.latest_deployment?.state;
  const netlifyState = (netlifyData as { latest_deploy?: { state: string } } | null)?.latest_deploy?.state;
  const stateColor = (s?: string) =>
    s === "READY" || s === "ready" ? "#34d399"
    : s === "ERROR" || s === "error" ? "#f87171"
    : "#fbbf24";

  return (
    <div style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Live Status
        </span>
        <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }} onClick={fetchAll} disabled={loading}>
          {loading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={11} />}
          {fetched ? "Refresh" : "Fetch Live Data"}
        </button>
      </div>

      {!fetched && !loading && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          Click &ldquo;Fetch Live Data&rdquo; to pull real-time stats from GitHub{deployUrl ? " and your hosting platform" : ""}.
        </p>
      )}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12 }}>
          <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Fetching live data...
        </div>
      )}

      {fetched && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {githubData && (
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Github size={13} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>GitHub</span>
                <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{(githubData as { full_name?: string }).full_name}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
                  {[
                    { label: "issues", value: (githubData as { open_issues?: number }).open_issues ?? 0 },
                    { label: "stars", value: (githubData as { stars?: number }).stars ?? 0 },
                  ].map(({ label, value }) => (
                    <span key={label} className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{value}</span> {label}
                    </span>
                  ))}
                </div>
              </div>
              {(githubData as { recent_commits?: { sha: string; message: string; author: string; date: string }[] }).recent_commits?.slice(0, 4).map((c) => (
                <div key={c.sha} className="flex items-center gap-2" style={{ padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                  <GitCommit size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span className="font-mono" style={{ fontSize: 10, color: "var(--accent)", flexShrink: 0 }}>{c.sha}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.message}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}

          {vercelData && (
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Vercel</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{(vercelData as { name?: string }).name}</span>
                {vercelState && <span style={{ marginLeft: "auto", fontSize: 10, color: stateColor(vercelState), fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{vercelState}</span>}
              </div>
              {(vercelData as { recent_deployments?: { state: string; url: string; created: number; message?: string }[] }).recent_deployments?.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center gap-2" style={{ padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: stateColor(d.state), flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.message ?? d.url}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{new Date(d.created).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}

          {netlifyData && (
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Globe size={13} style={{ color: "#00ad9f" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Netlify</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{(netlifyData as { name?: string }).name}</span>
                {netlifyState && <span style={{ marginLeft: "auto", fontSize: 10, color: stateColor(netlifyState), fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{netlifyState.toUpperCase()}</span>}
              </div>
              {(netlifyData as { recent_deploys?: { state: string; branch: string; title?: string; created_at: string; deploy_time?: number }[] }).recent_deploys?.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center gap-2" style={{ padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: stateColor(d.state), flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{d.title ?? d.branch}</span>
                  {d.deploy_time && <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.deploy_time}s</span>}
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              ))}
            </div>
          )}

          {!githubData && !vercelData && !netlifyData && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <AlertCircle size={12} />
              No live data found. Make sure your URLs are set in the Links fields above, and integrations are connected on the Integrations page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
