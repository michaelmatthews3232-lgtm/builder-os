"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewTaskModal } from "@/components/NewTaskModal";
import type { Project, Task, TaskStatus, PROJECT_STATUS_WEIGHT, PRIORITY_WEIGHT } from "@/lib/types";
import { format, isPast, isToday, parseISO, differenceInDays } from "date-fns";
import {
  Zap,
  Clock,
  CheckSquare,
  Circle,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";

// Sort weights
const STATUS_W: Record<string, number> = {
  monetizing: 1, scaling: 2, building: 3, planned: 4, idea: 5, archived: 99,
};
const PRIORITY_W: Record<string, number> = { high: 1, medium: 2, low: 3 };

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    const [{ data: tasksData }, { data: projectsData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, project:projects(id, name, status)")
        .neq("status", "done"),
      supabase.from("projects").select("*"),
    ]);
    setTasks((tasksData as Task[]) ?? []);
    setProjects((projectsData as Project[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Smart sort: overdue first, then due today, then by project status weight, then priority, then no due date
  const sortedTasks = [...tasks].sort((a, b) => {
    const aOverdue = a.due_date && isPast(parseISO(a.due_date)) && !isToday(parseISO(a.due_date));
    const bOverdue = b.due_date && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date));
    const aToday = a.due_date && isToday(parseISO(a.due_date));
    const bToday = b.due_date && isToday(parseISO(b.due_date));

    // Overdue first
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    // Today next
    if (aToday && !bToday) return -1;
    if (!aToday && bToday) return 1;
    // Project status weight
    const aProjectStatus = a.project?.status ?? "idea";
    const bProjectStatus = b.project?.status ?? "idea";
    const statusDiff = (STATUS_W[aProjectStatus] ?? 5) - (STATUS_W[bProjectStatus] ?? 5);
    if (statusDiff !== 0) return statusDiff;
    // Priority weight
    const priorityDiff = (PRIORITY_W[a.priority] ?? 2) - (PRIORITY_W[b.priority] ?? 2);
    if (priorityDiff !== 0) return priorityDiff;
    // Due date ascending (nulls last)
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return 0;
  });

  const overdueTasks = sortedTasks.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  );
  const todayTasks = sortedTasks.filter(
    (t) => t.due_date && isToday(parseISO(t.due_date))
  );
  const upcomingTasks = sortedTasks.filter(
    (t) => !t.due_date || (!isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)))
  );

  const markDone = async (taskId: string) => {
    setCompleting((prev) => new Set([...prev, taskId]));
    await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    await fetchData();
    setCompleting((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={20} style={{ color: "var(--accent)" }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              Today
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {format(new Date(), "EEEE, MMMM d")} · {sortedTasks.length} tasks to execute
            {overdueTasks.length > 0 && (
              <span style={{ color: "#f87171", marginLeft: 8, fontWeight: 600 }}>
                · {overdueTasks.length} overdue
              </span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
          Quick Task
        </button>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Today's Execution
            </span>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {todayTasks.length} due today
            </span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, var(--accent), #00a8ff)",
                width: `${todayTasks.length > 0 ? Math.min(100, (todayTasks.length / sortedTasks.length) * 100) : 0}%`,
                borderRadius: 99,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : sortedTasks.length === 0 ? (
        <div
          className="card"
          style={{ padding: 48, textAlign: "center" }}
        >
          <CheckSquare size={32} style={{ color: "var(--accent)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            Clear queue.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            No open tasks. Add something to execute on.
          </p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Add Task
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <TaskSection
              title="Overdue"
              icon={<AlertTriangle size={14} />}
              color="#f87171"
              tasks={overdueTasks}
              onComplete={markDone}
              completing={completing}
            />
          )}

          {/* Due Today */}
          {todayTasks.length > 0 && (
            <TaskSection
              title="Due Today"
              icon={<Clock size={14} />}
              color="var(--accent)"
              tasks={todayTasks}
              onComplete={markDone}
              completing={completing}
            />
          )}

          {/* Upcoming / Prioritized */}
          {upcomingTasks.length > 0 && (
            <TaskSection
              title="Up Next"
              icon={<Zap size={14} />}
              color="#fbbf24"
              tasks={upcomingTasks}
              onComplete={markDone}
              completing={completing}
            />
          )}
        </div>
      )}

      {showModal && (
        <NewTaskModal
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setShowModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}

function TaskSection({
  title,
  icon,
  color,
  tasks,
  onComplete,
  completing,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  tasks: Task[];
  onComplete: (id: string) => void;
  completing: Set<string>;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color }}>{icon}</span>
        <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {title}
        </h2>
        <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {tasks.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((task) => (
          <TodayTaskRow
            key={task.id}
            task={task}
            onComplete={onComplete}
            completing={completing.has(task.id)}
          />
        ))}
      </div>
    </section>
  );
}

function TodayTaskRow({
  task,
  onComplete,
  completing,
}: {
  task: Task;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && isToday(parseISO(task.due_date));
  const daysUntil = task.due_date ? differenceInDays(parseISO(task.due_date), new Date()) : null;

  return (
    <div
      className="card"
      style={{
        padding: "14px 18px",
        borderColor: isOverdue ? "rgba(248,113,113,0.2)" : isDueToday ? "rgba(0,212,160,0.12)" : undefined,
        background: isOverdue ? "rgba(248,113,113,0.02)" : isDueToday ? "rgba(0,212,160,0.02)" : undefined,
      }}
    >
      <div className="flex items-start gap-4">
        {/* Check button */}
        <button
          onClick={() => onComplete(task.id)}
          disabled={completing}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `1.5px solid ${task.priority === "high" ? "#f87171" : "rgba(255,255,255,0.15)"}`,
            background: completing ? "var(--accent-dim)" : "transparent",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s",
          }}
        >
          {completing && (
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />
          )}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 6 }}>
            {task.title}
          </div>
          {task.description && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            {task.project && (
              <Link
                href={`/projects/${task.project_id}`}
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  fontFamily: "JetBrains Mono, monospace",
                  background: "rgba(255,255,255,0.04)",
                  padding: "2px 8px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {task.project.name}
                <ArrowRight size={9} />
              </Link>
            )}
            <StatusBadge type="priority" value={task.priority} />
            {task.project && (
              <StatusBadge type="project" value={task.project.status} />
            )}
            {task.assigned_to !== "self" && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                → {task.assigned_to}
              </span>
            )}
          </div>
        </div>

        {/* Due date */}
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          {task.due_date ? (
            <div>
              <div
                className="font-mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isOverdue ? "#f87171" : isDueToday ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {isDueToday ? "TODAY" : isOverdue ? "OVERDUE" : format(parseISO(task.due_date), "MMM d")}
              </div>
              {!isOverdue && !isDueToday && daysUntil !== null && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  in {daysUntil}d
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>no date</span>
          )}
        </div>
      </div>
    </div>
  );
}
