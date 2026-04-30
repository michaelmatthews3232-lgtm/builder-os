"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  LLCProfile, Expense, ExpenseCategory, BillingCycle,
  Project, ProjectEntity,
} from "@/lib/types";
import {
  Building2, Edit3, Check, X, Plus, Trash2,
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Globe, Cpu, CreditCard, Package, Users, HelpCircle,
  Eye, EyeOff, RefreshCw, Loader2, Download,
} from "lucide-react";

// ── Config ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string; icon: React.ReactNode }> = {
  hosting:       { label: "Hosting",      color: "#60a5fa", icon: <Globe size={12} /> },
  ai_tools:      { label: "AI / APIs",    color: "#a78bfa", icon: <Cpu size={12} /> },
  subscriptions: { label: "Subscriptions",color: "#fbbf24", icon: <CreditCard size={12} /> },
  domain:        { label: "Domains",      color: "#34d399", icon: <Package size={12} /> },
  contractor:    { label: "Contractors",  color: "#f87171", icon: <Users size={12} /> },
  other:         { label: "Other",        color: "#6b7280", icon: <HelpCircle size={12} /> },
};

const ENTITY_CONFIG: Record<ProjectEntity, { label: string; color: string; bg: string }> = {
  llc:     { label: "LLC",     color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  personal:{ label: "Personal",color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  unknown: { label: "Unknown", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const BILLING_LABELS: Record<BillingCycle, string> = {
  monthly:  "Monthly",
  annual:   "Annual",
  one_time: "One-time",
};

function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  if (cycle === "annual") return amount / 12;
  if (cycle === "one_time") return 0;
  return amount;
}

// ── Insight rules ─────────────────────────────────────────

function generateInsights(projects: Project[], monthlyRevenue: number, monthlyExpenses: number): string[] {
  const insights: string[] = [];

  if (monthlyExpenses > monthlyRevenue && monthlyRevenue > 0) {
    insights.push(`You're spending $${(monthlyExpenses - monthlyRevenue).toFixed(0)}/mo more than you're earning. Focus on a revenue-generating project first.`);
  }
  if (monthlyRevenue === 0) {
    insights.push("No revenue yet. Prioritize getting one project to monetization before adding more expenses.");
  }

  const revenueProjects = projects.filter((p) => p.revenue_monthly > 0 && p.entity !== "llc");
  revenueProjects.forEach((p) => {
    insights.push(`"${p.name}" earns $${p.revenue_monthly}/mo but isn't tagged as LLC. Consider moving it for liability protection.`);
  });

  const healthApps = projects.filter((p) =>
    (p.name.toLowerCase().includes("body") || p.name.toLowerCase().includes("health") || p.name.toLowerCase().includes("compass")) && p.entity !== "llc"
  );
  healthApps.forEach((p) => {
    insights.push(`"${p.name}" handles health data — health tracking apps should typically be under an LLC to limit personal liability.`);
  });

  const unknown = projects.filter((p) => p.entity === "unknown" && p.status !== "archived");
  if (unknown.length > 0) {
    insights.push(`${unknown.length} project${unknown.length > 1 ? "s are" : " is"} not tagged as LLC or Personal. Tag them below so you can track compliance.`);
  }

  return insights;
}

// ── Page ──────────────────────────────────────────────────

export default function FinancePage() {
  const [llc, setLlc] = useState<LLCProfile | null>(null);
  const [editingLlc, setEditingLlc] = useState(false);
  const [llcForm, setLlcForm] = useState<Partial<LLCProfile>>({});
  const [showEin, setShowEin] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [stripeData, setStripeData] = useState<{
    mrr: number;
    active_subscriptions: number;
    total_customers: number | null;
    products: { id: string; name: string; mrr: number; subscriptions: number }[];
  } | null>(null);
  const [stripeFetching, setStripeFetching] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeMappings, setStripeMappings] = useState<Record<string, string>>({});
  const [applyingMappings, setApplyingMappings] = useState(false);

  const [addingExpense, setAddingExpense] = useState(false);
  const [expForm, setExpForm] = useState<{
    name: string; amount: string; category: ExpenseCategory;
    billing_cycle: BillingCycle; project_id: string; notes: string;
  }>({ name: "", amount: "", category: "other", billing_cycle: "monthly", project_id: "", notes: "" });

  const [contractorTotalPaid, setContractorTotalPaid] = useState(0);

  const fetchAll = useCallback(async () => {
    const [{ data: llcData }, { data: expData }, { data: projData }, { data: payData }] = await Promise.all([
      supabase.from("llc_profile").select("*").limit(1).single(),
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name, status, revenue_monthly, entity").neq("status", "archived"),
      supabase.from("contractor_payments").select("amount"),
    ]);
    setLlc(llcData as LLCProfile | null);
    setExpenses((expData as Expense[]) ?? []);
    setProjects((projData as Project[]) ?? []);
    const total = ((payData ?? []) as { amount: number }[]).reduce((s, p) => s + p.amount, 0);
    setContractorTotalPaid(total);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Stripe sync ───────────────────────────────────────
  const syncStripe = async () => {
    setStripeFetching(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/integrations/stripe");
      if (!res.ok) {
        const { error } = await res.json();
        setStripeError(error ?? "Failed to sync");
      } else {
        const data = await res.json();
        setStripeData(data);
        // Auto-suggest mappings: match product name to project name (fuzzy)
        const autoMap: Record<string, string> = {};
        for (const product of data.products ?? []) {
          const match = projects.find((p) =>
            p.name.toLowerCase().includes(product.name.toLowerCase()) ||
            product.name.toLowerCase().includes(p.name.toLowerCase())
          );
          if (match) autoMap[product.id] = match.id;
        }
        setStripeMappings(autoMap);
      }
    } catch {
      setStripeError("Network error");
    }
    setStripeFetching(false);
  };

  const applyStripeMappings = async () => {
    if (!stripeData) return;
    setApplyingMappings(true);
    const updates = Object.entries(stripeMappings).filter(([, projId]) => projId);
    for (const [productId, projectId] of updates) {
      const product = stripeData.products.find((p) => p.id === productId);
      if (product && projectId) {
        await supabase.from("projects").update({ revenue_monthly: Math.round(product.mrr * 100) / 100 }).eq("id", projectId);
      }
    }
    setApplyingMappings(false);
    fetchAll();
  };

  // ── LLC profile save ──────────────────────────────────
  const saveLlc = async () => {
    if (llc?.id) {
      await supabase.from("llc_profile").update(llcForm).eq("id", llc.id);
    } else {
      await supabase.from("llc_profile").insert({ ...llcForm, name: llcForm.name || "Origin Verification Systems LLC" });
    }
    setEditingLlc(false);
    fetchAll();
  };

  const startEditLlc = () => {
    setLlcForm({
      name: llc?.name ?? "Origin Verification Systems LLC",
      ein: llc?.ein ?? "",
      email: llc?.email ?? "",
      bank_name: llc?.bank_name ?? "",
      hosting_provider: llc?.hosting_provider ?? "",
      notes: llc?.notes ?? "",
    });
    setEditingLlc(true);
  };

  // ── Expenses ──────────────────────────────────────────
  const addExpense = async () => {
    if (!expForm.name.trim() || !expForm.amount) return;
    await supabase.from("expenses").insert({
      name: expForm.name.trim(),
      amount: parseFloat(expForm.amount),
      category: expForm.category,
      billing_cycle: expForm.billing_cycle,
      project_id: expForm.project_id || null,
      notes: expForm.notes.trim() || null,
      active: true,
    });
    setExpForm({ name: "", amount: "", category: "other", billing_cycle: "monthly", project_id: "", notes: "" });
    setAddingExpense(false);
    fetchAll();
  };

  const toggleExpenseActive = async (id: string, active: boolean) => {
    await supabase.from("expenses").update({ active: !active }).eq("id", id);
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, active: !active } : e));
  };

  const deleteExpense = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const updateProjectEntity = async (id: string, entity: ProjectEntity) => {
    await supabase.from("projects").update({ entity }).eq("id", id);
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, entity } : p));
  };

  // ── Derived numbers ───────────────────────────────────
  const monthlyRevenue = projects.reduce((s, p) => s + (p.revenue_monthly ?? 0), 0);
  const activeExpenses = expenses.filter((e) => e.active);
  const monthlyExpenses = activeExpenses.reduce((s, e) => s + monthlyEquivalent(e.amount, e.billing_cycle), 0);
  const netMonthly = monthlyRevenue - monthlyExpenses - contractorTotalPaid;
  const insights = generateInsights(projects, monthlyRevenue, monthlyExpenses);

  const expensesByCategory = Object.keys(CATEGORY_CONFIG).reduce<Record<ExpenseCategory, Expense[]>>((acc, cat) => {
    acc[cat as ExpenseCategory] = activeExpenses.filter((e) => e.category === cat);
    return acc;
  }, {} as Record<ExpenseCategory, Expense[]>);

  const exportTaxCsv = () => {
    const year = new Date().getFullYear();
    const rows: string[] = [
      "Type,Name,Category,Amount,Billing Cycle,Monthly Equivalent,Project,Notes,Added",
    ];
    for (const exp of expenses) {
      const proj = projects.find((p) => p.id === exp.project_id)?.name ?? "";
      const monthly = monthlyEquivalent(exp.amount, exp.billing_cycle);
      rows.push([
        "Expense",
        `"${exp.name.replace(/"/g, '""')}"`,
        CATEGORY_CONFIG[exp.category].label,
        exp.amount.toFixed(2),
        BILLING_LABELS[exp.billing_cycle],
        monthly.toFixed(2),
        `"${proj}"`,
        `"${(exp.notes ?? "").replace(/"/g, '""')}"`,
        exp.created_at ? new Date(exp.created_at).toLocaleDateString() : "",
      ].join(","));
    }
    rows.push("");
    rows.push("Type,Project,Monthly Revenue");
    for (const p of projects) {
      if (p.revenue_monthly > 0) {
        rows.push(["Revenue", `"${p.name.replace(/"/g, '""')}"`, p.revenue_monthly.toFixed(2)].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `builder-os-finances-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Finance</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>LLC profile, expenses, and revenue overview</p>
        </div>
        <button
          className="btn-ghost"
          onClick={exportTaxCsv}
          style={{ fontSize: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
        >
          <Download size={12} />
          Export Tax CSV
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Monthly Revenue", value: `$${monthlyRevenue.toLocaleString()}`, color: "#34d399", icon: <TrendingUp size={16} /> },
          { label: "Monthly Expenses", value: `$${monthlyExpenses.toFixed(0)}`, color: "#f87171", icon: <TrendingDown size={16} /> },
          { label: "Contractor Paid", value: `$${contractorTotalPaid.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: "#f87171", icon: <Users size={16} /> },
          {
            label: "Net Monthly",
            value: `${netMonthly >= 0 ? "+" : ""}$${netMonthly.toFixed(0)}`,
            color: netMonthly >= 0 ? "#34d399" : "#f87171",
            icon: <DollarSign size={16} />,
          },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="card" style={{ padding: "18px 20px" }}>
            <div className="flex items-center gap-2 mb-2" style={{ color }}>
              {icon}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
                {label}
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Stripe Revenue Sync */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CreditCard size={14} style={{ color: "#635bff" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Stripe Revenue</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— live MRR sync</span>
          </div>
          <button
            className="btn-ghost"
            onClick={syncStripe}
            disabled={stripeFetching}
            style={{ fontSize: 12, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}
          >
            {stripeFetching
              ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={11} />}
            {stripeFetching ? "Syncing..." : stripeData ? "Refresh" : "Sync from Stripe"}
          </button>
        </div>

        {stripeError && (
          <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>
            {stripeError === "Stripe integration not configured"
              ? "Connect your Stripe secret key in Integrations first."
              : stripeError}
          </p>
        )}

        {stripeData && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                { label: "MRR", value: `$${stripeData.mrr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#635bff" },
                { label: "Active Subscriptions", value: stripeData.active_subscriptions.toString(), color: "var(--text-primary)" },
                { label: "Total Customers", value: stripeData.total_customers != null ? stripeData.total_customers.toString() : "—", color: "var(--text-primary)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                  <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {stripeData.products.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>By Product — map to project</div>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 11, padding: "4px 12px" }}
                    onClick={applyStripeMappings}
                    disabled={applyingMappings || Object.values(stripeMappings).every((v) => !v)}
                  >
                    {applyingMappings ? "Applying..." : "Apply to Projects"}
                  </button>
                </div>
                {stripeData.products.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{p.name}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.subscriptions} sub{p.subscriptions !== 1 ? "s" : ""}</span>
                        <span className="font-mono" style={{ fontSize: 12, color: "#635bff", fontWeight: 700 }}>${p.mrr.toFixed(2)}/mo</span>
                      </div>
                    </div>
                    <select
                      className="input-base"
                      style={{ fontSize: 11, padding: "4px 8px", width: "auto", minWidth: 160 }}
                      value={stripeMappings[p.id] ?? ""}
                      onChange={(e) => setStripeMappings((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    >
                      <option value="">— no project —</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>{proj.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  Select a project for each product and click &quot;Apply to Projects&quot; to update revenue_monthly.
                </p>
              </div>
            )}

            {stripeData.products.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>No active subscriptions yet.</p>
            )}
          </div>
        )}

        {!stripeData && !stripeError && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Click Sync to pull live MRR and subscription data from Stripe.
          </p>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card" style={{ padding: "16px 18px", borderColor: "rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: "#fbbf24" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Insights
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => (
              <p key={i} style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0 }}>
                • {ins}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* LLC Profile */}
      <div className="card" style={{ padding: "20px 22px" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 size={15} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>LLC Profile</span>
          </div>
          {editingLlc ? (
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditingLlc(false)} style={{ fontSize: 12, padding: "5px 10px" }}>
                <X size={12} style={{ display: "inline", marginRight: 4 }} />Cancel
              </button>
              <button className="btn-primary" onClick={saveLlc} style={{ fontSize: 12, padding: "5px 12px" }}>
                <Check size={12} style={{ display: "inline", marginRight: 4 }} />Save
              </button>
            </div>
          ) : (
            <button className="btn-ghost" onClick={startEditLlc} style={{ fontSize: 12, padding: "5px 10px" }}>
              <Edit3 size={12} style={{ display: "inline", marginRight: 5 }} />Edit
            </button>
          )}
        </div>

        {editingLlc ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "name", label: "LLC Name", placeholder: "Origin Verification Systems LLC" },
              { key: "ein", label: "EIN", placeholder: "XX-XXXXXXX" },
              { key: "email", label: "LLC Email", placeholder: "business@yourdomain.com" },
              { key: "bank_name", label: "Bank", placeholder: "BlueVine, Chase, etc." },
              { key: "hosting_provider", label: "Domain / Hosting", placeholder: "Hostinger, Namecheap, etc." },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label>{label}</label>
                <input
                  className="input-base mt-1"
                  placeholder={placeholder}
                  value={(llcForm as Record<string, string>)[key] ?? ""}
                  onChange={(e) => setLlcForm({ ...llcForm, [key]: e.target.value })}
                  style={{ fontSize: 13 }}
                />
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Notes</label>
              <textarea
                className="input-base mt-1"
                placeholder="Any additional notes about your LLC..."
                value={llcForm.notes ?? ""}
                onChange={(e) => setLlcForm({ ...llcForm, notes: e.target.value })}
                style={{ fontSize: 13, minHeight: 70 }}
              />
            </div>
          </div>
        ) : llc ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "LLC Name", value: llc.name },
              {
                label: "EIN",
                value: llc.ein,
                sensitive: true,
                revealed: showEin,
                onToggle: () => setShowEin((v) => !v),
              },
              { label: "LLC Email", value: llc.email },
              { label: "Bank", value: llc.bank_name },
              { label: "Domain / Hosting", value: llc.hosting_provider },
              { label: "Notes", value: llc.notes, fullWidth: true },
            ]
              .filter((r) => r.value)
              .map((row, i) => (
                <div key={i} style={row.fullWidth ? { gridColumn: "1 / -1" } : {}}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
                    {row.label}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={row.sensitive ? "font-mono" : ""}
                      style={{
                        fontSize: 13,
                        color: "var(--text-primary)",
                        filter: row.sensitive && !row.revealed ? "blur(5px)" : "none",
                        userSelect: row.sensitive && !row.revealed ? "none" : "text",
                        transition: "filter 0.15s",
                      }}
                    >
                      {row.value}
                    </span>
                    {row.sensitive && (
                      <button
                        onClick={row.onToggle}
                        style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 2 }}
                      >
                        {row.revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No LLC profile yet. Click Edit to add your details.
          </p>
        )}
      </div>

      {/* Project entity tagger */}
      <div className="card" style={{ padding: "20px 22px" }}>
        <div className="flex items-center gap-2 mb-4">
          <Package size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Project Ownership</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>— LLC or Personal?</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {projects.map((p) => {
            const ec = ENTITY_CONFIG[p.entity ?? "unknown"];
            return (
              <div key={p.id} className="flex items-center justify-between" style={{ padding: "8px 12px", borderRadius: 7, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
                  {p.revenue_monthly > 0 && (
                    <span className="font-mono" style={{ fontSize: 10, color: "#34d399" }}>${p.revenue_monthly}/mo</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(["llc", "personal", "unknown"] as ProjectEntity[]).map((e) => (
                    <button
                      key={e}
                      onClick={() => updateProjectEntity(p.id, e)}
                      style={{
                        fontSize: 10,
                        padding: "3px 9px",
                        borderRadius: 99,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: `1px solid ${p.entity === e ? ENTITY_CONFIG[e].color : "var(--border)"}`,
                        background: p.entity === e ? ENTITY_CONFIG[e].bg : "transparent",
                        color: p.entity === e ? ENTITY_CONFIG[e].color : "var(--text-muted)",
                        fontFamily: "'Sora', sans-serif",
                        transition: "all 0.12s",
                      }}
                    >
                      {ENTITY_CONFIG[e].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense Tracker */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Expense Tracker</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {activeExpenses.length} active — ${monthlyExpenses.toFixed(2)}/mo burn
            </p>
          </div>
          <button className="btn-primary" onClick={() => setAddingExpense(true)} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            <Plus size={13} /> Add Expense
          </button>
        </div>

        {addingExpense && (
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Service / Tool Name *</label>
                <input
                  className="input-base mt-1"
                  placeholder="e.g. Netlify, Claude Pro, Vercel, Upwork"
                  value={expForm.name}
                  onChange={(e) => setExpForm({ ...expForm, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label>Amount ($)</label>
                <input
                  className="input-base mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label>Category</label>
                <select className="input-base mt-1" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value as ExpenseCategory })}>
                  {(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Billing Cycle</label>
                <select className="input-base mt-1" value={expForm.billing_cycle} onChange={(e) => setExpForm({ ...expForm, billing_cycle: e.target.value as BillingCycle })}>
                  {(Object.keys(BILLING_LABELS) as BillingCycle[]).map((c) => (
                    <option key={c} value={c}>{BILLING_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Project (optional)</label>
                <select className="input-base mt-1" value={expForm.project_id} onChange={(e) => setExpForm({ ...expForm, project_id: e.target.value })}>
                  <option value="">General / All projects</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Notes (optional)</label>
                <input
                  className="input-base mt-1"
                  placeholder="e.g. Pro plan, includes 100GB storage"
                  value={expForm.notes}
                  onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setAddingExpense(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={addExpense}
                disabled={!expForm.name.trim() || !expForm.amount}
              >
                Add Expense
              </button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
            No expenses tracked yet. Add your first tool or subscription.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((cat) => {
              const catExpenses = expenses.filter((e) => e.category === cat);
              if (catExpenses.length === 0) return null;
              const cfg = CATEGORY_CONFIG[cat];
              const catMonthly = catExpenses.filter((e) => e.active).reduce((s, e) => s + monthlyEquivalent(e.amount, e.billing_cycle), 0);
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {cfg.label}
                      </span>
                    </div>
                    {catMonthly > 0 && (
                      <span className="font-mono" style={{ fontSize: 11, color: cfg.color }}>${catMonthly.toFixed(2)}/mo</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {catExpenses.map((exp) => {
                      const monthly = monthlyEquivalent(exp.amount, exp.billing_cycle);
                      const projectName = projects.find((p) => p.id === exp.project_id)?.name;
                      return (
                        <div
                          key={exp.id}
                          className="card"
                          style={{
                            padding: "11px 14px",
                            opacity: exp.active ? 1 : 0.45,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{exp.name}</span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                                {BILLING_LABELS[exp.billing_cycle]}
                              </span>
                              {projectName && (
                                <span style={{ fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 6px", borderRadius: 4 }}>
                                  {projectName}
                                </span>
                              )}
                            </div>
                            {exp.notes && (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{exp.notes}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              <div className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                ${exp.amount.toFixed(2)}
                                <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)", marginLeft: 2 }}>
                                  /{exp.billing_cycle === "annual" ? "yr" : exp.billing_cycle === "one_time" ? "once" : "mo"}
                                </span>
                              </div>
                              {exp.billing_cycle === "annual" && (
                                <div className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  ≈ ${monthly.toFixed(2)}/mo
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => toggleExpenseActive(exp.id, exp.active)}
                              title={exp.active ? "Pause (not counting toward total)" : "Activate"}
                              style={{
                                width: 28,
                                height: 16,
                                borderRadius: 99,
                                border: "none",
                                cursor: "pointer",
                                background: exp.active ? "var(--accent)" : "rgba(255,255,255,0.1)",
                                position: "relative",
                                flexShrink: 0,
                                transition: "background 0.15s",
                              }}
                            >
                              <div style={{
                                position: "absolute",
                                top: 2,
                                left: exp.active ? 14 : 2,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: "#fff",
                                transition: "left 0.15s",
                              }} />
                            </button>
                            <button
                              onClick={() => deleteExpense(exp.id)}
                              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 3 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
