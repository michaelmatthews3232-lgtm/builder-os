"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewTaskModal } from "@/components/NewTaskModal";
import type { Project, Task, TaskStatus } from "@/lib/types";
import { Plus, Trash2, UserCircle, Clock, ChevronDown } from "lucide-react";
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
  const [view, setView] = useState<"board" | "list">("board");

  const fetchData = async () => {
    const [{ data: tasksData }, { data: projectsData }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, project:projects(id, name, status)")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
    ]);
    setTasks((tasksData as Task[]) ?? []);
    setProjects((projectsData as Project[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredTasks = filterProject === "all"
    ? tasks
    : tasks.filter((t) => t.project_id === filterProject);

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    fetchData();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    fetchData();
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Tasks
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {tasks.filter(t => t.status !== "done").length} open · {tasks.filter(t => t.status === "done").length} done
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: view === v ? "rgba(255,255,255,0.08)" : "transparent",
                  color: view === v ? "var(--text-primary)" : "var(--text-muted)",
                  border: "none",
                  fontFamily: "'Sora', sans-serif",
                  textTransform: "capitalize",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
            Add Task
          </button>
        </div>
      </div>

      {/* Project Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>PROJECT:</span>
        <button
          onClick={() => setFilterProject("all")}
          style={{
            padding: "4px 12px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid",
            borderColor: filterProject === "all" ? "var(--border-accent)" : "var(--border)",
            background: filterProject === "all" ? "var(--accent-dim)" : "transparent",
            color: filterProject === "all" ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          All
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setFilterProject(p.id)}
            style={{
              padding: "4px 12px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
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
      ) : view === "board" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
          {COLUMNS.map(({ status, label, color }) => {
            const colTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}
                  </span>
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {colTasks.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colTasks.map((task) => (
                    <TaskBoardCard
                      key={task.id}
                      task={task}
                      onStatusChange={updateStatus}
                      onDelete={deleteTask}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div
                      style={{
                        padding: "20px 16px",
                        border: "1px dashed rgba(255,255,255,0.06)",
                        borderRadius: 8,
                        textAlign: "center",
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredTasks.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
              No tasks found.
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskListRow key={task.id} task={task} onStatusChange={updateStatus} onDelete={deleteTask} />
            ))
          )}
        </div>
      )}

      {showModal && (
        <NewTaskModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}

function TaskBoardCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== "done";

  return (
    <div
      className="card card-hover"
      style={{
        padding: "12px 14px",
        opacity: task.status === "done" ? 0.55 : 1,
        borderColor: isOverdue ? "rgba(248,113,113,0.18)" : undefined,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.4 }}>
        {task.title}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.project && (
          <Link
            href={`/projects/${task.project_id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.05)",
              padding: "2px 7px",
              borderRadius: 4,
              textDecoration: "none",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {task.project.name}
          </Link>
        )}
        <StatusBadge type="priority" value={task.priority} />
        {task.due_date && (
          <span style={{ fontSize: 10, color: isOverdue ? "#f87171" : "var(--text-muted)", marginLeft: "auto" }}>
            {format(parseISO(task.due_date), "MMM d")}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 10,
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
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.5 }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function TaskListRow({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== "done";

  return (
    <div
      className="card"
      style={{
        padding: "11px 16px",
        opacity: task.status === "done" ? 0.5 : 1,
        borderColor: isOverdue ? "rgba(248,113,113,0.15)" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <StatusBadge type="task" value={task.status} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none" }}>
          {task.title}
        </span>
        {task.project && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            {task.project.name}
          </span>
        )}
        <StatusBadge type="priority" value={task.priority} />
        {task.due_date && (
          <span style={{ fontSize: 11, color: isOverdue ? "#f87171" : "var(--text-muted)", minWidth: 48, textAlign: "right" }}>
            {format(parseISO(task.due_date), "MMM d")}
          </span>
        )}
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-secondary)", fontSize: 11, padding: "3px 7px", cursor: "pointer", fontFamily: "'Sora', sans-serif" }}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <button onClick={() => onDelete(task.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
