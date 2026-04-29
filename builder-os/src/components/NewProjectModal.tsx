"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ProjectStatus } from "@/lib/types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function NewProjectModal({ onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    status: "idea" as ProjectStatus,
    revenue_monthly: "",
    deployment_url: "",
    github_repo_url: "",
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setLoading(true);

    const { error } = await supabase.from("projects").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      status: form.status,
      revenue_monthly: parseFloat(form.revenue_monthly) || 0,
      external_links: {
        stripe_dashboard_url: "",
        github_repo_url: form.github_repo_url.trim(),
        firebase_url: "",
        revenuecat_url: "",
        deployment_url: form.deployment_url.trim(),
        other_tools: [],
      },
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
            New Project
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
            <label>Project Name *</label>
            <input
              className="input-base mt-1.5"
              placeholder="e.g. CashLens"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label>Description</label>
            <textarea
              className="input-base mt-1.5"
              placeholder="What does this project do?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Category</label>
              <input
                className="input-base mt-1.5"
                placeholder="e.g. SaaS, App"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div>
              <label>Status</label>
              <select
                className="input-base mt-1.5"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
              >
                <option value="idea">Idea</option>
                <option value="planned">Planned</option>
                <option value="building">Building</option>
                <option value="monetizing">Monetizing</option>
                <option value="scaling">Scaling</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Monthly Revenue ($)</label>
              <input
                className="input-base mt-1.5"
                placeholder="0"
                type="number"
                min="0"
                value={form.revenue_monthly}
                onChange={(e) => setForm({ ...form, revenue_monthly: e.target.value })}
              />
            </div>
            <div>
              <label>Deployment URL</label>
              <input
                className="input-base mt-1.5"
                placeholder="https://"
                value={form.deployment_url}
                onChange={(e) => setForm({ ...form, deployment_url: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label>GitHub Repo</label>
            <input
              className="input-base mt-1.5"
              placeholder="https://github.com/..."
              value={form.github_repo_url}
              onChange={(e) => setForm({ ...form, github_repo_url: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-7">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !form.name.trim()}
            style={{ opacity: loading || !form.name.trim() ? 0.5 : 1 }}
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
