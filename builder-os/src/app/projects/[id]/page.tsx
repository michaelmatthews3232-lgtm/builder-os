"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewTaskModal } from "@/components/NewTaskModal";
import { KnowledgeTab } from "@/components/KnowledgeTab";
import type { Project, Task, Contractor, ContractorUpdate, TaskStatus, ProjectStatus, SalesLead, SalesLeadStatus } from "@/lib/types";
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
  Share2,
  Globe2,
  UserMinus,
  BookUser,
  Upload,
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "links" | "social" | "sales" | "marketing" | "contractors" | "vault">("tasks");
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkForm, setLinkForm] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<{ title: string; description: string | null; priority: "high" | "medium" | "low" }[]>([]);
  const [selectedGenTasks, setSelectedGenTasks] = useState<Set<number>>(new Set());
  const [addingGenTasks, setAddingGenTasks] = useState(false);
  const [oneTimeTotal, setOneTimeTotal] = useState(0);
  const [generatingMarketing, setGeneratingMarketing] = useState(false);
  const [marketingPlan, setMarketingPlan] = useState<Record<string, unknown> | null>(null);
  const [marketingError, setMarketingError] = useState<string | null>(null);

  const fetchData = async () => {
    const [{ data: proj }, { data: taskData }, { data: contractorData }, { data: expData }] =
      await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("tasks").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        supabase.from("contractors").select("*").eq("project_id", id),
        supabase.from("expenses").select("amount").eq("project_id", id).eq("billing_cycle", "one_time"),
      ]);

    setProject(proj as Project);
    setTasks((taskData as Task[]) ?? []);
    setContractors((contractorData as Contractor[]) ?? []);
    const total = ((expData ?? []) as { amount: number }[]).reduce((s, e) => s + e.amount, 0);
    setOneTimeTotal(total);
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

  const generateMarketingPlan = async () => {
    if (!project) return;
    setGeneratingMarketing(true);
    setMarketingError(null);
    try {
      const res = await fetch("/api/generate-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: project.name, description: project.description, status: project.status }),
      });
      const body = await res.json();
      if (body.plan) {
        setMarketingPlan(body.plan);
      } else {
        setMarketingError(body.error ?? "Generation failed — try again");
      }
    } catch {
      setMarketingError("Network error — check your connection");
    }
    setGeneratingMarketing(false);
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "To Do", value: todoTasks.length.toString(), color: "#6b7280" },
          { label: "In Progress", value: inProgressTasks.length.toString(), color: "#fbbf24" },
          { label: "Done", value: doneTasks.length.toString(), color: "#34d399" },
          { label: "Invested", value: oneTimeTotal > 0 ? `$${oneTimeTotal.toLocaleString()}` : "—", color: oneTimeTotal > 0 ? "#f87171" : "var(--text-muted)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: "14px 18px", textAlign: "center" }}>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>
              {value}
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
          {(["tasks", "links", "social", "sales", "marketing", "contractors", "vault"] as const).map((tab) => (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                    <span style={{ color: "var(--accent)" }}><ExternalLink size={13} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{tool.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tool.url.replace(/^https?:\/\//, "")}</div>
                    </div>
                    <a href={tool.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: "var(--accent)", color: "#fff", textDecoration: "none", flexShrink: 0 }}>
                      Visit <ExternalLink size={11} />
                    </a>
                  </div>
                ))}
            </div>

          </div>
        )}

        {/* Sales Tab */}
        {activeTab === "sales" && (
          <SalesTab projectId={id} />
        )}

        {/* Marketing Tab */}
        {activeTab === "marketing" && (
          <MarketingTab
            project={project}
            plan={marketingPlan}
            generating={generatingMarketing}
            error={marketingError}
            onGenerate={generateMarketingPlan}
            onClear={() => { setMarketingPlan(null); setMarketingError(null); }}
          />
        )}

        {/* Contractors Tab */}
        {activeTab === "contractors" && (
          <ContractorsTab projectId={id} contractors={contractors} onUpdate={fetchData} />
        )}

        {/* Social Tab */}
        {activeTab === "social" && (
          <SocialTab projectId={id} />
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", opacity: 0.35 }}>
        <span style={{ color: "var(--text-muted)" }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Not set</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url.replace(/^https?:\/\//, "")}
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700,
          background: "var(--accent)", color: "#fff", textDecoration: "none",
          flexShrink: 0, transition: "opacity 0.12s", letterSpacing: "0.01em",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        onClick={(e) => e.stopPropagation()}
      >
        Visit <ExternalLink size={11} />
      </a>
    </div>
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
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryContractors, setLibraryContractors] = useState<Contractor[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "notes" | "payments">>({});
  const [updates, setUpdates] = useState<Record<string, ContractorUpdate[]>>({});
  const [payments, setPayments] = useState<Record<string, ContractorPayment[]>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [addingNote, setAddingNote] = useState<string | null>(null);
  const [addingPayment, setAddingPayment] = useState<string | null>(null);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paid_date: new Date().toISOString().split("T")[0], notes: "" });
  const [assigning, setAssigning] = useState<string | null>(null);

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

  const fetchLibrary = async () => {
    // Show all contractors not currently on this project (unassigned OR on other projects)
    const { data } = await supabase
      .from("contractors")
      .select("*, project:projects(id, name)")
      .or(`project_id.is.null,project_id.neq.${projectId}`)
      .order("name");
    setLibraryContractors((data as (Contractor & { project?: { id: string; name: string } | null })[]) ?? []);
  };

  const assignFromLibrary = async (contractorId: string) => {
    setAssigning(contractorId);
    const { error } = await supabase
      .from("contractors")
      .update({ project_id: projectId, status: "active" })
      .eq("id", contractorId);
    if (!error) {
      setShowLibrary(false);
      setLibraryContractors([]);
      setLibrarySearch("");
    }
    setAssigning(null);
    onUpdate();
  };

  const unassign = async (id: string) => {
    await supabase.from("contractors").update({ project_id: null }).eq("id", id);
    onUpdate();
  };

  const deleteFromSystem = async (id: string) => {
    await Promise.all([
      supabase.from("contractor_updates").delete().eq("contractor_id", id),
      supabase.from("contractor_payments").delete().eq("contractor_id", id),
    ]);
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
      <div className="flex items-center justify-between mb-4">
        <button
          className="btn-ghost"
          onClick={() => { setShowLibrary((v) => !v); if (!showLibrary) fetchLibrary(); }}
          style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
        >
          <BookUser size={13} />
          {showLibrary ? "Hide Library" : "Assign from Library"}
        </button>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={13} style={{ display: "inline", marginRight: 6 }} />
          Add New Contractor
        </button>
      </div>

      {/* Library picker */}
      {showLibrary && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BookUser size={13} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Contractor Library</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— saved contractors not on any project</span>
          </div>
          <input
            className="input-base"
            placeholder="Search library..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            style={{ marginBottom: 10, fontSize: 12 }}
          />
          {libraryContractors.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
              No other contractors found. Add a new one above or unassign one from another project first.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {libraryContractors
                .filter((c) => !librarySearch || c.name.toLowerCase().includes(librarySearch.toLowerCase()) || (c.role ?? "").toLowerCase().includes(librarySearch.toLowerCase()))
                .map((c) => {
                  const withProject = c as Contractor & { project?: { id: string; name: string } | null };
                  const isOnOtherProject = withProject.project != null;
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                        {c.role && <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{c.role}</span>}
                        {c.platform && <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4, marginLeft: 6 }}>{c.platform}</span>}
                        {c.hourly_rate != null && <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>${c.hourly_rate}/hr</span>}
                        {isOnOtherProject && (
                          <span style={{ fontSize: 10, color: "#fbbf24", background: "rgba(251,191,36,0.1)", padding: "1px 7px", borderRadius: 4, marginLeft: 8, fontWeight: 600 }}>
                            on {withProject.project!.name}
                          </span>
                        )}
                        {!isOnOtherProject && (
                          <span style={{ fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 7px", borderRadius: 4, marginLeft: 8, fontWeight: 600 }}>
                            unassigned
                          </span>
                        )}
                      </div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}
                        onClick={() => assignFromLibrary(c.id)}
                        disabled={assigning === c.id}
                      >
                        {assigning === c.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : null}
                        {assigning === c.id ? "Assigning..." : isOnOtherProject ? "Move Here" : "Assign"}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

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
                      <button
                        onClick={() => unassign(c.id)}
                        title="Unassign from project (keeps in library)"
                        style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                      >
                        <UserMinus size={13} />
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
                      <div className="flex justify-end mb-3">
                        <button
                          onClick={() => deleteFromSystem(c.id)}
                          style={{ fontSize: 10, color: "#f87171", background: "none", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 5, cursor: "pointer", padding: "3px 8px", display: "flex", alignItems: "center", gap: 4 }}
                          title="Permanently delete this contractor from the system"
                        >
                          <Trash2 size={10} /> Delete from system
                        </button>
                      </div>
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
                                  {confirmDeletePayment === p.id ? (
                                    <div className="flex items-center gap-1" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 5, padding: "2px 6px" }}>
                                      <span style={{ fontSize: 10, color: "#f87171" }}>Delete?</span>
                                      <button
                                        onClick={() => { deletePayment(c.id, p.id); setConfirmDeletePayment(null); }}
                                        style={{ fontSize: 10, fontWeight: 700, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: "0 3px" }}
                                      >Yes</button>
                                      <button
                                        onClick={() => setConfirmDeletePayment(null)}
                                        style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                                      ><X size={10} /></button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeletePayment(p.id)}
                                      style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
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

// ── Sales Tab ─────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

type ParsedLead = { contact_name: string; contact_info: string; source: string; notes: string };

function parseCSV(text: string): ParsedLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/^"|"$/g, "").trim());

  const col = (row: string[], ...names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex((h) => h === name || h.includes(name));
      if (idx >= 0) return (row[idx] ?? "").replace(/^"|"$/g, "").trim();
    }
    return "";
  };

  const firstLast = (row: string[]) => {
    const first = col(row, "first_name", "first");
    const last = col(row, "last_name", "last");
    if (first || last) return [first, last].filter(Boolean).join(" ");
    return "";
  };

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const row = parseCSVLine(line);
      const name =
        col(row, "name", "contact_name", "full_name", "business_name", "company") ||
        firstLast(row);
      const contact =
        col(row, "email", "email_address", "contact_info", "contact", "phone", "phone_number", "mobile");
      const source = col(row, "source", "channel", "referral", "how_found");
      const notes = col(row, "notes", "note", "description", "comments", "comment");
      return { contact_name: name, contact_info: contact, source, notes };
    })
    .filter((r) => r.contact_name || r.contact_info);
}

const SALES_STATUSES: SalesLeadStatus[] = ["lead", "contacted", "responded", "converted", "lost"];

const SALES_STATUS_CONFIG: Record<SalesLeadStatus, { color: string; bg: string }> = {
  lead:      { color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  contacted: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  responded: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  converted: { color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  lost:      { color: "#f87171", bg: "rgba(248,113,113,0.1)" },
};

function SalesTab({ projectId }: { projectId: string }) {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [adding, setAdding] = useState(false);
  const [milestoneGoal, setMilestoneGoal] = useState("");
  const [editingMilestone, setEditingMilestone] = useState(false);
  const [form, setForm] = useState({ contact_name: "", contact_info: "", source: "", notes: "", status: "lead" as SalesLeadStatus });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SalesLeadStatus | "all">("all");
  const [importPreview, setImportPreview] = useState<ParsedLead[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLeads = async () => {
    const { data } = await supabase.from("project_sales").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setLeads((data as SalesLead[]) ?? []);
    const goal = (data as SalesLead[] | null)?.[0]?.milestone_goal ?? "";
    if (goal && !milestoneGoal) setMilestoneGoal(goal);
  };

  useEffect(() => { fetchLeads(); }, [projectId]);

  const addLead = async () => {
    setSaving(true);
    await supabase.from("project_sales").insert({
      project_id: projectId,
      contact_name: form.contact_name.trim() || null,
      contact_info: form.contact_info.trim() || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      milestone_goal: milestoneGoal.trim() || null,
    });
    setForm({ contact_name: "", contact_info: "", source: "", notes: "", status: "lead" });
    setAdding(false);
    setSaving(false);
    fetchLeads();
  };

  const updateStatus = async (id: string, status: SalesLeadStatus) => {
    await supabase.from("project_sales").update({ status }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
  };

  const deleteLead = async (id: string) => {
    await supabase.from("project_sales").delete().eq("id", id);
    fetchLeads();
  };

  const saveMilestone = async () => {
    await supabase.from("project_sales").update({ milestone_goal: milestoneGoal.trim() || null }).eq("project_id", projectId);
    setEditingMilestone(false);
    fetchLeads();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportPreview(parseCSV(text));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!importPreview.length) return;
    setImporting(true);
    await supabase.from("project_sales").insert(
      importPreview.map((r) => ({
        project_id: projectId,
        contact_name: r.contact_name || null,
        contact_info: r.contact_info || null,
        source: r.source || null,
        notes: r.notes || null,
        status: "lead" as SalesLeadStatus,
        milestone_goal: milestoneGoal.trim() || null,
      }))
    );
    setImportPreview([]);
    setImporting(false);
    fetchLeads();
  };

  const filtered = filterStatus === "all" ? leads : leads.filter((l) => l.status === filterStatus);
  const converted = leads.filter((l) => l.status === "converted").length;

  return (
    <div>
      {/* Milestone goal */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <DollarSign size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 3 }}>Milestone Goal</div>
          {editingMilestone ? (
            <div className="flex items-center gap-2">
              <input
                className="input-base"
                style={{ flex: 1, fontSize: 13, padding: "5px 8px" }}
                placeholder="e.g. 100 users, $1,000 MRR, 10 paying customers"
                value={milestoneGoal}
                onChange={(e) => setMilestoneGoal(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveMilestone(); if (e.key === "Escape") setEditingMilestone(false); }}
              />
              <button className="btn-primary" style={{ fontSize: 11, padding: "5px 10px" }} onClick={saveMilestone}>Save</button>
              <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setEditingMilestone(false)}>Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2" onClick={() => setEditingMilestone(true)} style={{ cursor: "pointer" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: milestoneGoal ? "var(--accent)" : "var(--text-muted)" }}>
                {milestoneGoal || "Set a milestone goal..."}
              </span>
              <Edit3 size={11} style={{ color: "var(--text-muted)" }} />
            </div>
          )}
        </div>
        <div className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          {converted}/{leads.length} converted
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(["all", ...SALES_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s as typeof filterStatus)}
              style={{
                padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid",
                borderColor: filterStatus === s ? "var(--border-accent)" : "var(--border)",
                background: filterStatus === s ? "var(--accent-dim)" : "transparent",
                color: filterStatus === s ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: 12 }}
          >
            <Upload size={13} style={{ display: "inline", marginRight: 6 }} />
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={13} style={{ display: "inline", marginRight: 6 }} />
            Add Lead
          </button>
        </div>
      </div>

      {/* CSV import preview */}
      {importPreview.length > 0 && (
        <div
          className="card"
          style={{ padding: 18, marginBottom: 16, borderColor: "rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.04)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                {importPreview.length} leads ready to import
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                all set to &quot;lead&quot; status
              </span>
            </div>
            <button
              onClick={() => setImportPreview([])}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Preview rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {importPreview.slice(0, 5).map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  padding: "7px 10px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{r.contact_name || <span style={{ color: "var(--text-muted)" }}>—</span>}</span>
                <span style={{ color: "var(--text-secondary)" }}>{r.contact_info || <span style={{ color: "var(--text-muted)" }}>—</span>}</span>
                <span style={{ color: "var(--text-muted)" }}>{r.source || r.notes || "—"}</span>
              </div>
            ))}
            {importPreview.length > 5 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 10px" }}>
                + {importPreview.length - 5} more
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-primary"
              onClick={confirmImport}
              disabled={importing}
            >
              {importing ? "Importing..." : `Import ${importPreview.length} Leads`}
            </button>
            <button className="btn-ghost" onClick={() => setImportPreview([])}>Cancel</button>
          </div>
        </div>
      )}

      {adding && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Contact Name</label>
              <input className="input-base mt-1" placeholder="John Smith" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} autoFocus />
            </div>
            <div>
              <label>Contact Info (email / LinkedIn / phone)</label>
              <input className="input-base mt-1" placeholder="john@company.com" value={form.contact_info} onChange={(e) => setForm({ ...form, contact_info: e.target.value })} />
            </div>
            <div>
              <label>Status</label>
              <select className="input-base mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SalesLeadStatus })}>
                {SALES_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label>Source (how they found you)</label>
              <input className="input-base mt-1" placeholder="Twitter, referral, cold outreach..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div style={{ gridColumn: "2 / -1" }}>
              <label>Notes</label>
              <input className="input-base mt-1" placeholder="Any context about this lead..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" onClick={addLead} disabled={saving}>
              {saving ? "Saving..." : "Add Lead"}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          <DollarSign size={24} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13, marginBottom: 12 }}>No {filterStatus !== "all" ? filterStatus : ""} leads yet.</p>
          <button className="btn-primary" onClick={() => setAdding(true)}>Add First Lead</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((lead) => {
            const sc = SALES_STATUS_CONFIG[lead.status];
            return (
              <div key={lead.id} className="card" style={{ padding: "13px 16px" }}>
                <div className="flex items-center gap-4">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {lead.contact_name || "Unnamed Lead"}
                      </span>
                      {lead.source && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                          {lead.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {lead.contact_info && (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{lead.contact_info}</span>
                      )}
                      {lead.notes && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{lead.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value as SalesLeadStatus)}
                      style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                        padding: "3px 8px", borderRadius: 99, fontFamily: "JetBrains Mono, monospace",
                        border: `1px solid ${sc.color}40`, background: sc.bg, color: sc.color, cursor: "pointer",
                      }}
                    >
                      {SALES_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => deleteLead(lead.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Marketing Tab ─────────────────────────────────────────────────────────────

function MarketingTab({
  project,
  plan,
  generating,
  error,
  onGenerate,
  onClear,
}: {
  project: Project;
  plan: Record<string, unknown> | null;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onClear: () => void;
}) {
  if (!plan) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 16 }}>
        <Sparkles size={32} style={{ color: "var(--accent)", opacity: 0.6 }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Generate a Marketing Plan</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 400 }}>
            Claude will create a tailored marketing plan for <strong style={{ color: "var(--text-secondary)" }}>{project.name}</strong> — channels, 30-day plan, content ideas, and KPIs.
          </p>
        </div>
        {error && (
          <p style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 7, padding: "8px 14px" }}>
            {error}
          </p>
        )}
        <button
          className="btn-primary"
          onClick={onGenerate}
          disabled={generating}
          style={{ fontSize: 13, padding: "10px 24px", display: "flex", alignItems: "center", gap: 8 }}
        >
          {generating
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
            : <><Sparkles size={14} /> {error ? "Try Again" : "Generate Plan"}</>}
        </button>
      </div>
    );
  }

  type PlanChannel = { name: string; priority: string; rationale: string };
  type PlanWeek = { week: number; focus: string; actions: string[] };
  const channels = (plan.channels as PlanChannel[]) ?? [];
  const thirtyDay = (plan.thirty_day_plan as PlanWeek[]) ?? [];
  const contentIdeas = (plan.content_ideas as string[]) ?? [];
  const growthTactics = (plan.growth_tactics as string[]) ?? [];
  const kpis = (plan.kpis as string[]) ?? [];
  const priorityColor = (p: string) => p === "high" ? "#f87171" : p === "medium" ? "#fbbf24" : "#6b7280";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Marketing Plan — {project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }} onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={11} />}
            Regenerate
          </button>
          <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={onClear}>Clear</button>
        </div>
      </div>

      {/* Positioning + Audience */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Positioning", value: plan.positioning as string },
          { label: "Target Audience", value: plan.target_audience as string },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Channels */}
      {channels.length > 0 && (
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 10 }}>Channels</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {channels.map((ch, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor(ch.priority), textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", flexShrink: 0, marginTop: 1 }}>
                  {ch.priority}
                </span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ch.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{ch.rationale}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 30-day plan */}
      {thirtyDay.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 8 }}>30-Day Plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {thirtyDay.map((w) => (
              <div key={w.week} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>Week {w.week} — {w.focus}</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {(w.actions ?? []).map((a, i) => (
                    <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content ideas + Growth tactics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {contentIdeas.length > 0 && (
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 8 }}>Content Ideas</div>
            {contentIdeas.map((idea, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, paddingBottom: 4 }}>• {idea}</div>
            ))}
          </div>
        )}
        {growthTactics.length > 0 && (
          <div className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 8 }}>Growth Tactics</div>
            {growthTactics.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, paddingBottom: 4 }}>• {t}</div>
            ))}
          </div>
        )}
      </div>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 8 }}>KPIs to Track</div>
          <div className="flex items-center gap-3 flex-wrap">
            {kpis.map((kpi, i) => (
              <span key={i} style={{ fontSize: 12, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", padding: "4px 10px", borderRadius: 6 }}>
                {kpi}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Social Media Tab ─────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  "Instagram", "X / Twitter", "TikTok", "YouTube", "LinkedIn",
  "Facebook", "Threads", "Pinterest", "Snapchat", "Other",
];

const PLATFORM_COLORS: Record<string, string> = {
  "Instagram": "#e1306c", "X / Twitter": "#1da1f2", "TikTok": "#ff0050",
  "YouTube": "#ff0000", "LinkedIn": "#0077b5", "Facebook": "#1877f2",
  "Threads": "#8b5cf6", "Pinterest": "#e60023", "Snapchat": "#fbbf24",
};

interface SocialAccount {
  id: string;
  project_id: string;
  platform: string;
  handle: string | null;
  url: string | null;
  followers: number | null;
  notes: string | null;
  created_at: string;
}

function SocialTab({ projectId }: { projectId: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: "Instagram", handle: "", url: "", followers: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from("project_social")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    setAccounts((data as SocialAccount[]) ?? []);
  };

  useEffect(() => { fetchAccounts(); }, [projectId]);

  const addAccount = async () => {
    if (!form.platform) return;
    setSaving(true);
    await supabase.from("project_social").insert({
      project_id: projectId,
      platform: form.platform,
      handle: form.handle.trim() || null,
      url: form.url.trim() || null,
      followers: form.followers ? parseInt(form.followers) : null,
      notes: form.notes.trim() || null,
    });
    setForm({ platform: "Instagram", handle: "", url: "", followers: "", notes: "" });
    setAdding(false);
    setSaving(false);
    fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    await supabase.from("project_social").delete().eq("id", id);
    fetchAccounts();
  };

  const totalFollowers = accounts.reduce((s, a) => s + (a.followers ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Share2 size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Social Media</span>
          {totalFollowers > 0 && (
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {totalFollowers.toLocaleString()} total followers
            </span>
          )}
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={13} style={{ display: "inline", marginRight: 6 }} />
          Add Account
        </button>
      </div>

      {adding && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Platform *</label>
              <select className="input-base mt-1" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Handle / Username</label>
              <input className="input-base mt-1" placeholder="@yourbrand" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} autoFocus />
            </div>
            <div>
              <label>Followers</label>
              <input className="input-base mt-1" type="number" placeholder="0" value={form.followers} onChange={(e) => setForm({ ...form, followers: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Profile URL</label>
              <input className="input-base mt-1" placeholder="https://instagram.com/yourbrand" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Notes (optional)</label>
              <input className="input-base mt-1" placeholder="e.g. Main brand account, posting 3x/week" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary" onClick={addAccount} disabled={saving}>
              {saving ? "Saving..." : "Add Account"}
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !adding ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          <Globe2 size={24} style={{ margin: "0 auto 10px" }} />
          <p style={{ marginBottom: 12, fontSize: 13 }}>No social accounts added yet.</p>
          <button className="btn-primary" onClick={() => setAdding(true)}>Add First Account</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {accounts.map((a) => {
            const color = PLATFORM_COLORS[a.platform] ?? "var(--accent)";
            return (
              <div key={a.id} className="card" style={{ padding: "14px 18px" }}>
                <div className="flex items-center gap-4">
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `${color}18`, border: `1px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color, fontFamily: "JetBrains Mono, monospace" }}>
                      {a.platform.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{a.platform}</span>
                      {a.handle && (
                        <span className="font-mono" style={{ fontSize: 12, color }}>@{a.handle.replace(/^@/, "")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {a.followers != null && (
                        <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                          {a.followers.toLocaleString()} followers
                        </span>
                      )}
                      {a.notes && (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: color, color: "#fff", textDecoration: "none" }}>
                        Visit <ExternalLink size={10} />
                      </a>
                    )}
                    <button onClick={() => deleteAccount(a.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
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
