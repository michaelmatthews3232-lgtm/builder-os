"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { KnowledgeItem, KnowledgeCategory } from "@/lib/types";
import {
  Lock, Key, Globe, CreditCard, User, FileText,
  Eye, EyeOff, Trash2, Edit3, Check, X, Plus,
  Upload, Loader2, Download,
} from "lucide-react";

const CATEGORY_CONFIG: Record<KnowledgeCategory, { label: string; color: string; icon: React.ReactNode }> = {
  credential: { label: "Credentials",  color: "#f87171", icon: <Lock size={12} /> },
  api_key:    { label: "API Keys",     color: "#a78bfa", icon: <Key size={12} /> },
  url:        { label: "URLs",         color: "#60a5fa", icon: <Globe size={12} /> },
  payment:    { label: "Payment",      color: "#34d399", icon: <CreditCard size={12} /> },
  account:    { label: "Accounts",     color: "#fbbf24", icon: <User size={12} /> },
  note:       { label: "Notes",        color: "#6b7280", icon: <FileText size={12} /> },
};

const CATEGORY_ORDER: KnowledgeCategory[] = ["credential", "api_key", "url", "payment", "account", "note"];

interface ExtractedPreviewItem {
  label: string;
  value: string;
  category: KnowledgeCategory;
  notes?: string;
  selected: boolean;
}

interface Props {
  projectId: string;
  projectName?: string;
}

export function KnowledgeTab({ projectId, projectName }: Props) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", value: "", category: "note" as KnowledgeCategory, notes: "" });
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ label: "", value: "", category: "note" as KnowledgeCategory, notes: "" });
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [preview, setPreview] = useState<ExtractedPreviewItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [extractError, setExtractError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("project_knowledge")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    setItems((data as KnowledgeItem[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteItem = async (id: string) => {
    await supabase.from("project_knowledge").delete().eq("id", id);
    fetchItems();
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setEditForm({ label: item.label, value: item.value, category: item.category, notes: item.notes ?? "" });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.label.trim()) return;
    await supabase.from("project_knowledge").update({
      label: editForm.label.trim(),
      value: editForm.value.trim(),
      category: editForm.category,
      notes: editForm.notes.trim() || null,
    }).eq("id", editingId);
    setEditingId(null);
    fetchItems();
  };

  const addItem = async () => {
    if (!newItem.label.trim() || !newItem.value.trim()) return;
    await supabase.from("project_knowledge").insert({
      project_id: projectId,
      label: newItem.label.trim(),
      value: newItem.value.trim(),
      category: newItem.category,
      notes: newItem.notes.trim() || null,
    });
    setNewItem({ label: "", value: "", category: "note", notes: "" });
    setAdding(false);
    fetchItems();
  };

  const extractFromFile = useCallback(async (file: File) => {
    setExtracting(true);
    setExtractError("");
    setPreview(null);

    const content = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsText(file);
    });

    if (!content.trim()) {
      setExtracting(false);
      setExtractError("Could not read file content.");
      return;
    }

    try {
      const res = await fetch("/api/extract-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename: file.name }),
      });
      const { items: extracted } = await res.json();
      if (!extracted || extracted.length === 0) {
        setExtractError("No credentials or important info found in this file.");
      } else {
        setPreview(extracted.map((i: Omit<ExtractedPreviewItem, "selected">) => ({ ...i, selected: true })));
      }
    } catch {
      setExtractError("Extraction failed — check your API key.");
    }

    setExtracting(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) extractFromFile(file);
  }, [extractFromFile]);

  const savePreview = async () => {
    if (!preview) return;
    const selected = preview.filter((i) => i.selected);
    if (selected.length === 0) return;
    setSaving(true);
    await supabase.from("project_knowledge").insert(
      selected.map((i) => ({
        project_id: projectId,
        label: i.label,
        value: i.value,
        category: i.category,
        notes: i.notes ?? null,
      }))
    );
    setPreview(null);
    setSaving(false);
    fetchItems();
  };

  const exportCsv = () => {
    const rows = ["Category,Label,Value,Purpose"];
    for (const cat of CATEGORY_ORDER) {
      for (const item of items.filter((i) => i.category === cat)) {
        rows.push([
          CATEGORY_CONFIG[cat].label,
          `"${item.label.replace(/"/g, '""')}"`,
          `"${item.value.replace(/"/g, '""')}"`,
          `"${(item.notes ?? "").replace(/"/g, '""')}"`,
        ].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName ?? "project").replace(/\s+/g, "-").toLowerCase()}-vault.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = CATEGORY_ORDER.reduce<Record<KnowledgeCategory, KnowledgeItem[]>>(
    (acc, cat) => ({ ...acc, [cat]: items.filter((i) => i.category === cat) }),
    {} as Record<KnowledgeCategory, KnowledgeItem[]>
  );

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* File drop zone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? "var(--accent)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 8,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: dragging ? "var(--accent-dim)" : "rgba(255,255,255,0.015)",
            transition: "all 0.15s",
          }}
        >
          {extracting ? (
            <>
              <Loader2 size={18} style={{ color: "var(--accent)", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Extracting credentials with AI...</span>
            </>
          ) : (
            <>
              <Upload size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 1 }}>
                  Drop a file to extract credentials & info
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Accepts .txt, .md, .env, .json, .yaml — Claude pulls out keys, logins, URLs, payment info
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 12, flexShrink: 0 }}
              >
                Browse
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) extractFromFile(f); e.target.value = ""; }}
              />
            </>
          )}
        </div>
      )}

      {extractError && (
        <p style={{ fontSize: 12, color: "#f87171" }}>{extractError}</p>
      )}

      {/* Extraction preview */}
      {preview && (
        <div className="card" style={{ padding: 20 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                Review Extracted Items
              </h3>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Uncheck anything you don&apos;t want to save
              </p>
            </div>
            <button
              onClick={() => setPreview(null)}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {preview.map((item, i) => {
              const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.note;
              return (
                <label
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 7,
                    background: item.selected ? "rgba(255,255,255,0.03)" : "transparent",
                    border: "1px solid",
                    borderColor: item.selected ? "var(--border)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() =>
                      setPreview((prev) =>
                        prev!.map((p, j) => j === i ? { ...p, selected: !p.selected } : p)
                      )
                    }
                    style={{ marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</span>
                      <span style={{ fontSize: 10, color: cfg.color, background: `${cfg.color}18`, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                    </div>
                    <span
                      className="font-mono"
                      style={{ fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" }}
                    >
                      {item.value}
                    </span>
                    {item.notes && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, display: "block", fontStyle: "italic" }}>
                        {item.notes}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPreview(null)} style={{ fontSize: 12 }}>
              Discard
            </button>
            <button
              className="btn-primary"
              onClick={savePreview}
              disabled={saving || !preview.some((i) => i.selected)}
              style={{ fontSize: 12, opacity: saving || !preview.some((i) => i.selected) ? 0.5 : 1 }}
            >
              {saving ? "Saving..." : `Save ${preview.filter((i) => i.selected).length} items`}
            </button>
          </div>
        </div>
      )}

      {/* Manual add + export */}
      <div className="flex justify-end gap-2">
        {items.length > 0 && (
          <button className="btn-ghost" onClick={exportCsv} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={12} /> Export CSV
          </button>
        )}
        <button className="btn-ghost" onClick={() => setAdding(true)} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
          <Plus size={13} /> Add Manually
        </button>
      </div>

      {adding && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Label</label>
              <input
                className="input-base mt-1"
                placeholder="e.g. Stripe API Key"
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label>Category</label>
              <select
                className="input-base mt-1"
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value as KnowledgeCategory })}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-ghost" onClick={() => setAdding(false)} style={{ padding: "8px 10px" }}>
                <X size={13} />
              </button>
              <button
                className="btn-primary"
                onClick={addItem}
                disabled={!newItem.label.trim() || !newItem.value.trim()}
                style={{ padding: "8px 10px", opacity: !newItem.label.trim() || !newItem.value.trim() ? 0.5 : 1 }}
              >
                <Check size={13} />
              </button>
            </div>
          </div>
          <div>
            <label>Value</label>
            <textarea
              className="input-base mt-1"
              placeholder="The actual key, password, URL, or info..."
              value={newItem.value}
              onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
              style={{ minHeight: 60 }}
            />
          </div>
          <div>
            <label>Purpose <span style={{ textTransform: "none", fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>(optional — what is this used for?)</span></label>
            <input
              className="input-base mt-1"
              placeholder="e.g. Handles all payment processing — changing this breaks checkout"
              value={newItem.notes}
              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Items grouped by category */}
      {items.length === 0 && !adding ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          No vault items yet. Drop a file or add manually.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {CATEGORY_ORDER.map((cat) => {
            const catItems = grouped[cat];
            if (catItems.length === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {cfg.label}
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{catItems.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {catItems.map((item) => (
                    <div key={item.id} className="card" style={{ padding: "12px 14px" }}>
                      {editingId === item.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <input
                              className="input-base"
                              value={editForm.label}
                              onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                              style={{ fontSize: 12, padding: "6px 10px" }}
                            />
                            <select
                              className="input-base"
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value as KnowledgeCategory })}
                              style={{ fontSize: 12, padding: "6px 10px" }}
                            >
                              {CATEGORY_ORDER.map((c) => (
                                <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            className="input-base"
                            value={editForm.value}
                            onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                            style={{ fontSize: 12, padding: "6px 10px", minHeight: 52 }}
                          />
                          <input
                            className="input-base"
                            placeholder="Purpose — what is this used for? (optional)"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            style={{ fontSize: 12, padding: "6px 10px" }}
                          />
                          <div className="flex justify-end gap-2">
                            <button className="btn-ghost" onClick={() => setEditingId(null)} style={{ fontSize: 11, padding: "5px 10px" }}>Cancel</button>
                            <button className="btn-primary" onClick={saveEdit} style={{ fontSize: 11, padding: "5px 10px" }}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>
                              {item.label}
                            </div>
                            {item.notes && (
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontStyle: "italic", lineHeight: 1.4 }}>
                                {item.notes}
                              </div>
                            )}
                            <div
                              className="font-mono"
                              style={{
                                fontSize: 11,
                                color: "var(--text-secondary)",
                                wordBreak: "break-all",
                                lineHeight: 1.5,
                                filter: revealed.has(item.id) ? "none" : "blur(4px)",
                                userSelect: revealed.has(item.id) ? "text" : "none",
                                transition: "filter 0.15s",
                              }}
                            >
                              {item.value}
                            </div>
                          </div>
                          <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                            <button
                              onClick={() => toggleReveal(item.id)}
                              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 4 }}
                              title={revealed.has(item.id) ? "Hide" : "Reveal"}
                            >
                              {revealed.has(item.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              onClick={() => startEdit(item)}
                              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 4 }}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 4 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
