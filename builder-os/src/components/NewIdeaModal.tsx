"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { IdeaStatus } from "@/lib/types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function NewIdeaModal({ onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "idea" as IdeaStatus,
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);

    const { error } = await supabase.from("ideas").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
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
            Capture Idea
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
            <label>Idea Title *</label>
            <input
              className="input-base mt-1.5"
              placeholder="What's the concept?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label>Description</label>
            <textarea
              className="input-base mt-1.5"
              placeholder="The problem it solves, potential audience, early hypothesis..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label>Status</label>
            <select
              className="input-base mt-1.5"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as IdeaStatus })}
            >
              <option value="idea">Idea</option>
              <option value="validated">Validated</option>
            </select>
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
            {loading ? "Saving..." : "Save Idea"}
          </button>
        </div>
      </div>
    </div>
  );
}
