"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewProjectModal } from "@/components/NewProjectModal";
import { NewTaskModal } from "@/components/NewTaskModal";
import type { Project, Task, BlockedReason } from "@/lib/types";
import { BLOCKER_REASON_CONFIG } from "@/lib/types";
import {
  TrendingUp,
  FolderKanban,
  CheckSquare,
  Zap,
  Plus,
  ArrowRight,
  Clock,
  AlertCircle,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const fetchData = async () => {
    const [{ data: projectsData }, { data: tasksData }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*, project:projects(id, name, status)")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    setProjects((projectsData as Project[]) ?? []);
    setTasks((tasksData as Task[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Stats
  const totalRevenue = projects.reduce((sum, p) => sum + (p.revenue_monthly ?? 0), 0);
  const activeProjects = projects.filter((p) => p.status !== "archived").length;
  const todayTasks = tasks.filter(
    (t) => t.due_date && isToday(parseISO(t.due_date))
  );
  const overdueTasks = tasks.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  );

  // Status breakdown
  const statusGroups: Record<string, number> = {};
  projects.forEach((p) => {
    statusGroups[p.status] = (statusGroups[p.status] ?? 0) + 1;
  });

  const blockedTasks = tasks.filter((t) => t.is_blocked);
  const totalUnblockCost = blockedTasks.reduce((s, t) => s + (t.unblock_cost ?? 0), 0);

  // Top 5 priority tasks for dashboard (exclude blocked)
  const priorityMap: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const focusTasks = [...tasks.filter((t) => !t.is_blocked)]
    .sort((a, b) => (priorityMap[a.priority] ?? 3) - (priorityMap[b.priority] ?? 3))
    .slice(0, 5);

  // Recently active projects (building/monetizing/scaling first)
  const activeProjectsSorted = [...projects]
    .filter((p) => p.status !== "archived")
    .sort((a, b) => {
      const order: Record<string, number> = { monetizing: 1, scaling: 2, building: 3, planned: 4, idea: 5 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    })
    .slice(0, 4);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="font-mono" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Control Portal
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {format(new Date(), "EEEE, MMMM d, yyyy")} — {activeProjects} active projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setShowNewTask(true)}>
            <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
            Task
          </button>
          <button className="btn-primary" onClick={() => setShowNewProject(true)}>
            <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
            Project
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Monthly Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          accent={totalRevenue > 0}
        />
        <StatCard
          icon={<FolderKanban size={16} />}
          label="Active Projects"
          value={String(activeProjects)}
        />
        <StatCard
          icon={<CheckSquare size={16} />}
          label="Open Tasks"
          value={String(tasks.length)}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : undefined}
          warn={overdueTasks.length > 0}
        />
        <StatCard
          icon={<Zap size={16} />}
          label="Due Today"
          value={String(todayTasks.length)}
          accent={todayTasks.length > 0}
        />
        {blockedTasks.length > 0 && (
          <StatCard
            icon={<AlertTriangle size={16} />}
            label="Blocked"
            value={String(blockedTasks.length)}
            sub={totalUnblockCost > 0 ? `$${totalUnblockCost.toFixed(0)} to unblock` : undefined}
            warn
          />
        )}
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Left: Projects */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Active Projects */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                Active Projects
              </h2>
              <Link
                href="/projects"
                style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeProjectsSorted.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div className="card card-hover" style={{ padding: "14px 16px" }}>
                    <div className="flex items-center justify-between">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2.5 mb-1">
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                            {project.name}
                          </span>
                          <StatusBadge type="project" value={project.status} />
                        </div>
                        {project.category && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            {project.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {project.revenue_monthly > 0 && (
                          <span
                            className="font-mono"
                            style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}
                          >
                            ${project.revenue_monthly.toLocaleString()}/mo
                          </span>
                        )}
                        <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Pipeline */}
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
              Pipeline
            </h2>
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { key: "monetizing", label: "Monetizing", color: "#34d399" },
                  { key: "scaling", label: "Scaling", color: "#a78bfa" },
                  { key: "building", label: "Building", color: "#fbbf24" },
                  { key: "planned", label: "Planned", color: "#60a5fa" },
                  { key: "idea", label: "Idea", color: "#6b7280" },
                ].map(({ key, label, color }) => {
                  const count = statusGroups[key] ?? 0;
                  const pct = activeProjects ? (count / activeProjects) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span style={{ width: 72, fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, flexShrink: 0 }}>
                        {label}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 99,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: color,
                            borderRadius: 99,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", width: 16, textAlign: "right" }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Right: Focus Tasks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              Focus Queue
            </h2>
            <Link
              href="/today"
              style={{
                fontSize: 11,
                color: "var(--accent)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontWeight: 600,
              }}
            >
              Full view <ArrowRight size={11} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {focusTasks.length === 0 ? (
              <div
                className="card"
                style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}
              >
                No open tasks. Add something to work on.
              </div>
            ) : (
              focusTasks.map((task) => (
                <FocusTaskRow key={task.id} task={task} onUpdate={fetchData} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Blockers Section */}
      {blockedTasks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} style={{ color: "#fb923c" }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>What&apos;s Blocking You</h2>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{blockedTasks.length}</span>
            </div>
            {totalUnblockCost > 0 && (
              <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: "#34d399" }}>
                <DollarSign size={12} />
                <span className="font-mono" style={{ fontWeight: 700 }}>${totalUnblockCost.toFixed(0)}</span>
                <span style={{ color: "var(--text-muted)" }}>total to unblock</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {blockedTasks.map((task) => {
              const cfg = task.blocked_reason ? BLOCKER_REASON_CONFIG[task.blocked_reason as BlockedReason] : null;
              return (
                <div key={task.id} className="card" style={{ padding: "12px 16px", borderColor: "rgba(251,146,60,0.2)" }}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={12} style={{ color: "#fb923c", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{task.title}</span>
                        {task.project && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>
                            {task.project.name}
                          </span>
                        )}
                        {cfg && (
                          <span style={{ fontSize: 10, color: cfg.color, background: `${cfg.color}18`, padding: "1px 7px", borderRadius: 4, fontWeight: 600 }}>
                            {cfg.label}
                          </span>
                        )}
                      </div>
                      {task.blocked_notes && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}>{task.blocked_notes}</p>
                      )}
                    </div>
                    {task.unblock_cost != null && (
                      <div className="font-mono" style={{ fontSize: 12, color: "#34d399", flexShrink: 0, fontWeight: 600 }}>
                        ${task.unblock_cost}/mo to fix
                      </div>
                    )}
                    <ArrowRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modals */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreated={fetchData} />
      )}
      {showNewTask && (
        <NewTaskModal
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setShowNewTask(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        borderColor: accent ? "var(--border-accent)" : undefined,
      }}
    >
      <div
        className="flex items-center gap-2 mb-3"
        style={{ color: accent ? "var(--accent)" : "var(--text-muted)" }}
      >
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </span>
      </div>
      <div
        className="stat-num"
        style={{ color: accent ? "var(--accent)" : undefined }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: warn ? "#f87171" : "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          {warn && <AlertCircle size={10} />}
          {sub}
        </div>
      )}
    </div>
  );
}

function FocusTaskRow({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
  const [checking, setChecking] = useState(false);

  const markDone = async () => {
    setChecking(true);
    await supabase.from("tasks").update({ status: "done" }).eq("id", task.id);
    onUpdate();
  };

  const isOverdue =
    task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && isToday(parseISO(task.due_date));

  return (
    <div
      className="card"
      style={{
        padding: "12px 14px",
        borderColor: isOverdue ? "rgba(248,113,113,0.2)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={markDone}
          disabled={checking}
          style={{
            width: 17,
            height: 17,
            borderRadius: 4,
            border: "1.5px solid",
            borderColor: task.priority === "high" ? "#f87171" : "var(--border)",
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: 1,
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor =
              task.priority === "high" ? "#f87171" : "var(--border)";
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4 }}>
            {task.title}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.project && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontFamily: "JetBrains Mono, monospace",
                  background: "rgba(255,255,255,0.04)",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                {task.project.name}
              </span>
            )}
            <StatusBadge type="priority" value={task.priority} />
            {task.due_date && (
              <span
                style={{
                  fontSize: 10,
                  color: isOverdue ? "#f87171" : isDueToday ? "var(--accent)" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Clock size={9} />
                {isOverdue ? "Overdue · " : isDueToday ? "Today · " : ""}
                {format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
