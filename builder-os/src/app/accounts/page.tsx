"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  KeyRound, Plus, Trash2, Eye, EyeOff, ExternalLink, AlertTriangle,
  Check, X, Edit3, Search, RefreshCw,
} from "lucide-react";

type CredCategory = "email" | "social" | "dev_tools" | "payment" | "domain" | "app_store" | "other";

interface AccountCredential {
  id: string;
  service_name: string;
  username: string | null;
  email: string | null;
  password: string | null;
  url: string | null;
  category: CredCategory;
  notes: string | null;
  needs_update: boolean;
  created_at: string;
}

const CATEGORY_CONFIG: Record<CredCategory, { label: string; color: string }> = {
  email:      { label: "Email",       color: "#60a5fa" },
  social:     { label: "Social",      color: "#e1306c" },
  dev_tools:  { label: "Dev Tools",  color: "#a78bfa" },
  payment:    { label: "Payment",     color: "#34d399" },
  domain:     { label: "Domain",      color: "#fbbf24" },
  app_store:  { label: "App Store",   color: "#fb923c" },
  other:      { label: "Other",       color: "#6b7280" },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as CredCategory[];

const emptyForm = {
  service_name: "", username: "", email: "", password: "",
  url: "", category: "other" as CredCategory, notes: "",
};

export default function AccountsPage() {
  const [creds, setCreds] = useState<AccountCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<CredCategory | "all" | "needs_update">("all");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const fetchAll = async () => {
    const { data } = await supabase
      .from("account_credentials")
      .select("*")
      .order("service_name");
    setCreds((data as AccountCredential[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const addCred = async () => {
    if (!form.service_name.trim()) return;
    setSaving(true);
    await supabase.from("account_credentials").insert({
      service_name: form.service_name.trim(),
      username: form.username.trim() || null,
      email: form.email.trim() || null,
      password: form.password || null,
      url: form.url.trim() || null,
      category: form.category,
      notes: form.notes.trim() || null,
      needs_update: false,
    });
    setForm(emptyForm);
    setAdding(false);
    setSaving(false);
    fetchAll();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.from("account_credentials").update({
      service_name: editForm.service_name.trim(),
      username: editForm.username.trim() || null,
      email: editForm.email.trim() || null,
      password: editForm.password || null,
      url: editForm.url.trim() || null,
      category: editForm.category,
      notes: editForm.notes.trim() || null,
    }).eq("id", editingId);
    setEditingId(null);
    fetchAll();
  };

  const toggleNeedsUpdate = async (id: string, current: boolean) => {
    await supabase.from("account_credentials").update({ needs_update: !current }).eq("id", id);
    setCreds((prev) => prev.map((c) => c.id === id ? { ...c, needs_update: !current } : c));
  };

  const deleteCred = async (id: string) => {
    await supabase.from("account_credentials").delete().eq("id", id);
    setCreds((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startEdit = (c: AccountCredential) => {
    setEditingId(c.id);
    setEditForm({
      service_name: c.service_name,
      username: c.username ?? "",
      email: c.email ?? "",
      password: c.password ?? "",
      url: c.url ?? "",
      category: c.category,
      notes: c.notes ?? "",
    });
  };

  const filtered = creds.filter((c) => {
    const matchSearch = !search ||
      c.service_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.username ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat =
      filterCat === "all" ? true :
      filterCat === "needs_update" ? c.needs_update :
      c.category === filterCat;
    return matchSearch && matchCat;
  });

  const needsUpdateCount = creds.filter((c) => c.needs_update).length;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Accounts
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {creds.length} saved · {needsUpdateCount > 0 && (
              <span style={{ color: "#fbbf24", fontWeight: 600 }}>{needsUpdateCount} need updating</span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
          Add Account
        </button>
      </div>

      {/* Needs-update alert */}
      {needsUpdateCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 8, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <AlertTriangle size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <strong style={{ color: "#fbbf24" }}>{needsUpdateCount} account{needsUpdateCount !== 1 ? "s" : ""}</strong> flagged for email or password update.{" "}
            <button onClick={() => setFilterCat("needs_update")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, textDecoration: "underline" }}>
              View them →
            </button>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input-base"
            style={{ paddingLeft: 32 }}
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5" style={{ flexWrap: "wrap" }}>
          {(["all", "needs_update", ...CATEGORIES] as const).map((cat) => {
            const cfg = cat === "all" ? null : cat === "needs_update" ? null : CATEGORY_CONFIG[cat];
            const label = cat === "all" ? "All" : cat === "needs_update" ? `⚠ Needs Update${needsUpdateCount > 0 ? ` (${needsUpdateCount})` : ""}` : cfg!.label;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat as typeof filterCat)}
                style={{
                  padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid",
                  borderColor: filterCat === cat ? (cfg?.color ?? "var(--border-accent)") : "var(--border)",
                  background: filterCat === cat ? (cfg ? `${cfg.color}18` : "var(--accent-dim)") : "transparent",
                  color: filterCat === cat ? (cfg?.color ?? "var(--accent)") : "var(--text-muted)",
                  transition: "all 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Service Name *</label>
              <input className="input-base mt-1" placeholder="e.g. Hostinger, Google, Apple" value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} autoFocus />
            </div>
            <div>
              <label>Category</label>
              <select className="input-base mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CredCategory })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>)}
              </select>
            </div>
            <div>
              <label>URL</label>
              <input className="input-base mt-1" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div>
              <label>Username / Handle</label>
              <input className="input-base mt-1" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label>Email</label>
              <input className="input-base mt-1" type="email" placeholder="account@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label>Password</label>
              <input className="input-base mt-1" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Notes (e.g. "needs to switch to LLC email", "shared with contractor")</label>
              <input className="input-base mt-1" placeholder="Any notes about this account..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => { setAdding(false); setForm(emptyForm); }}>Cancel</button>
            <button className="btn-primary" onClick={addCred} disabled={saving || !form.service_name.trim()}>
              {saving ? "Saving..." : "Save Account"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <KeyRound size={28} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
            {filterCat === "needs_update" ? "No accounts flagged for update." : "No accounts yet. Add your first one above."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((c) => {
            const cfg = CATEGORY_CONFIG[c.category] ?? CATEGORY_CONFIG.other;
            const isRevealed = revealed.has(c.id);
            const isEditing = editingId === c.id;

            if (isEditing) {
              return (
                <div key={c.id} className="card" style={{ padding: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label>Service Name</label>
                      <input className="input-base mt-1" value={editForm.service_name} onChange={(e) => setEditForm({ ...editForm, service_name: e.target.value })} autoFocus />
                    </div>
                    <div>
                      <label>Category</label>
                      <select className="input-base mt-1" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as CredCategory })}>
                        {CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>URL</label>
                      <input className="input-base mt-1" value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} />
                    </div>
                    <div>
                      <label>Username</label>
                      <input className="input-base mt-1" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                    </div>
                    <div>
                      <label>Email</label>
                      <input className="input-base mt-1" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    </div>
                    <div>
                      <label>Password</label>
                      <input className="input-base mt-1" type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label>Notes</label>
                      <input className="input-base mt-1" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn-primary" style={{ fontSize: 11 }} onClick={saveEdit}>
                      <Check size={11} style={{ display: "inline", marginRight: 4 }} />Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  borderColor: c.needs_update ? "rgba(251,191,36,0.25)" : undefined,
                  background: c.needs_update ? "rgba(251,191,36,0.03)" : undefined,
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Category dot + name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{c.service_name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: cfg.color, background: `${cfg.color}18`, padding: "1px 6px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                        {cfg.label}
                      </span>
                      {c.needs_update && (
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fbbf24", background: "rgba(251,191,36,0.12)", padding: "1px 7px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                          ⚠ Needs Update
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-5 flex-wrap" style={{ fontSize: 12 }}>
                      {c.username && (
                        <div>
                          <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>User</span>
                          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{c.username}</span>
                        </div>
                      )}
                      {c.email && (
                        <div>
                          <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>Email</span>
                          <span style={{ color: "var(--text-secondary)" }}>{c.email}</span>
                        </div>
                      )}
                      {c.password && (
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pass</span>
                          <span
                            className="font-mono"
                            style={{
                              color: "var(--text-secondary)",
                              filter: isRevealed ? "none" : "blur(4px)",
                              userSelect: isRevealed ? "text" : "none",
                              transition: "filter 0.15s",
                              fontSize: 12,
                            }}
                          >
                            {c.password}
                          </span>
                          <button onClick={() => toggleReveal(c.id)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                            {isRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      )}
                      {c.notes && (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 11 }}>{c.notes}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--border-accent)", padding: "5px 10px", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}>
                        <ExternalLink size={10} /> Visit
                      </a>
                    )}
                    <button
                      onClick={() => toggleNeedsUpdate(c.id, c.needs_update)}
                      title={c.needs_update ? "Mark as up to date" : "Flag for update"}
                      style={{
                        padding: "5px 7px", borderRadius: 6, border: `1px solid ${c.needs_update ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
                        background: c.needs_update ? "rgba(251,191,36,0.12)" : "transparent",
                        color: c.needs_update ? "#fbbf24" : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      <RefreshCw size={11} />
                    </button>
                    <button onClick={() => startEdit(c)} style={{ color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", padding: "5px 7px" }}>
                      <Edit3 size={11} />
                    </button>
                    {confirmDelete === c.id ? (
                      <div className="flex items-center gap-1" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 6, padding: "4px 8px" }}>
                        <span style={{ fontSize: 10, color: "#f87171" }}>Delete?</span>
                        <button onClick={() => deleteCred(c.id)} style={{ fontSize: 10, fontWeight: 700, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: "0 3px" }}>Yes</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}><X size={10} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(c.id)} style={{ color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", padding: "5px 7px" }}>
                        <Trash2 size={11} />
                      </button>
                    )}
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
