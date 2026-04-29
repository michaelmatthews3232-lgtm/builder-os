"use client";

import { useState } from "react";
import { X, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ProjectStatus } from "@/lib/types";
import type { ParsedProject } from "@/components/FolderDropZone";

interface Props {
  initialData: ParsedProject;
  fileCount: number;
  onClose: () => void;
  onCreated: () => void;
}

export function ProjectImportModal({ initialData, fileCount, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: initialData.name || "",
    description: initialData.description || "",
    category: initialData.category || "",
    status: (initialData.status as ProjectStatus) || "planned",
    revenue_monthly: initialData.revenue_monthly ? String(initialData.revenue_monthly) : "",
    deployment_url: initialData.deployment_url || "",
    github_repo_url: initialData.github_repo_url || "",
    firebase_url: initialData.firebase_url || "",
    stripe_dashboard_url: initialData.stripe_dashboard_url || "",
    revenuecat_url: initialData.revenuecat_url || "",
  });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);

    await supabase.from("projects").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      status: form.status,
      revenue_monthly: parseFloat(form.revenue_monthly) || 0,
      external_links: {
        stripe_dashboard_url: form.stripe_dashboard_url.trim(),
        github_repo_url: form.github_repo_url.trim(),
        firebase_url: form.firebase_url.trim(),
        revenuecat_url: form.revenuecat_url.trim(),
        deployment_url: form.deployment_url.trim(),
        other_tools: [],
      },
    });

    setLoading(false);
    onCreated();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
            Import Project
          </h2>
          <button
            onClick={onClose}
            style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Source badge */}
        <div
          className="flex items-center gap-2 mb-5"
          style={{
            padding: "6px 10px",
            background: "rgba(0,212,160,0.06)",
            border: "1px solid rgba(0,212,160,0.15)",
            borderRadius: 6,
          }}
        >
          <FileText size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            Extracted from {fileCount} file{fileCount !== 1 ? "s" : ""} — review and edit before saving
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label>Project Name *</label>
            <input
              className="input-base mt-1.5"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label>Description</label>
            <textarea
              className="input-base mt-1.5"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ minHeight: 72 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Category</label>
              <input
                className="input-base mt-1.5"
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Firebase URL</label>
              <input
                className="input-base mt-1.5"
                placeholder="https://"
                value={form.firebase_url}
                onChange={(e) => setForm({ ...form, firebase_url: e.target.value })}
              />
            </div>
            <div>
              <label>RevenueCat URL</label>
              <input
                className="input-base mt-1.5"
                placeholder="https://"
                value={form.revenuecat_url}
                onChange={(e) => setForm({ ...form, revenuecat_url: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
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
