"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Project, TaskStatus, TaskPriority } from "@/lib/types";

interface Props {
  projects: Pick<Project, "id" | "name">[];
  defaultProjectId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function NewTaskModal({ projects, defaultProjectId, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    project_id: defaultProjectId ?? (projects[0]?.id ?? ""),
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    assigned_to: "self",
    due_date: "",
  });

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.project_id) return;
    setLoading(true);

    const { error } = await supabase.from("tasks").insert({
      project_id: form.project_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      assigned_to: form.assigned_to.trim() || "self",
      due_date: form.due_date || null,
    });

    setLoading(false);
    if (!error) {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
            New Task
          </h2>
          <button
            onClick={onClose}
            style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label>Project *</label>
            <select
              className="input-base mt-1.5"
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Task Title *</label>
            <input
              className="input-base mt-1.5"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label>Description</label>
            <textarea
              className="input-base mt-1.5"
              placeholder="Details, context, acceptance criteria..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label>Status</label>
              <select
                className="input-base mt-1.5"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select
                className="input-base mt-1.5"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label>Assigned To</label>
              <input
                className="input-base mt-1.5"
                placeholder="self"
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label>Due Date</label>
            <input
              className="input-base mt-1.5"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-7">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !form.title.trim()}
            style={{ opacity: loading || !form.title.trim() ? 0.5 : 1 }}
          >
            {loading ? "Creating..." : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
