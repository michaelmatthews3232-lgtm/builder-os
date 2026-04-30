"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Contractor } from "@/lib/types";
import { Users, DollarSign, ArrowRight, ExternalLink } from "lucide-react";

interface ContractorWithProject extends Contractor {
  project?: { id: string; name: string };
  total_paid?: number;
}

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active:    { color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  completed: { color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
  inactive:  { color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "inactive">("all");

  const fetchAll = async () => {
    const [{ data: contractorData }, { data: paymentData }] = await Promise.all([
      supabase
        .from("contractors")
        .select("*, project:projects(id, name)")
        .order("created_at", { ascending: false }),
      supabase.from("contractor_payments").select("contractor_id, amount"),
    ]);

    const payments = (paymentData ?? []) as { contractor_id: string; amount: number }[];
    const totals: Record<string, number> = {};
    for (const p of payments) {
      totals[p.contractor_id] = (totals[p.contractor_id] ?? 0) + p.amount;
    }

    const merged = ((contractorData ?? []) as ContractorWithProject[]).map((c) => ({
      ...c,
      total_paid: totals[c.id] ?? 0,
    }));

    setContractors(merged);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = filterStatus === "all" ? contractors : contractors.filter((c) => c.status === filterStatus);

  const totalPaid = contractors.reduce((s, c) => s + (c.total_paid ?? 0), 0);
  const activeCount = contractors.filter((c) => c.status === "active").length;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Contractors
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {activeCount} active · {contractors.length} total
            {totalPaid > 0 && (
              <span style={{ color: "#f87171", marginLeft: 8, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                · ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} paid out
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Active", value: activeCount, color: "#34d399" },
          { label: "Total Contractors", value: contractors.length, color: "var(--text-primary)" },
          { label: "Total Paid Out", value: `$${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: "#f87171" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
            <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["all", "active", "completed", "inactive"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "5px 14px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "1px solid",
              borderColor: filterStatus === s ? "var(--border-accent)" : "var(--border)",
              background: filterStatus === s ? "var(--accent-dim)" : "transparent",
              color: filterStatus === s ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.12s",
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <Users size={28} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {filterStatus === "all" ? "No contractors yet. Add them from a project's Contractors tab." : `No ${filterStatus} contractors.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => {
            const sc = STATUS_COLOR[c.status] ?? STATUS_COLOR.inactive;
            return (
              <div key={c.id} className="card" style={{ padding: "16px 20px" }}>
                <div className="flex items-center gap-4">
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{c.name}</span>
                      {c.role && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.role}</span>}
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                        padding: "2px 7px", borderRadius: 99,
                        color: sc.color, background: sc.bg,
                        fontFamily: "JetBrains Mono, monospace",
                      }}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {c.email && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.email}</span>
                      )}
                      {c.platform && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "1px 7px", borderRadius: 4 }}>
                          {c.platform}
                        </span>
                      )}
                      {c.hourly_rate != null && (
                        <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          ${c.hourly_rate}/hr
                        </span>
                      )}
                      {(c.total_paid ?? 0) > 0 && (
                        <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: "#f87171", display: "flex", alignItems: "center", gap: 3 }}>
                          <DollarSign size={10} />
                          {(c.total_paid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project link */}
                  {c.project && (
                    <Link
                      href={`/projects/${c.project.id}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        fontSize: 12, color: "var(--accent)", textDecoration: "none",
                        background: "var(--accent-dim)", border: "1px solid var(--border-accent)",
                        padding: "6px 12px", borderRadius: 7, fontWeight: 600, flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.project.name}
                      <ArrowRight size={11} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
        To add contractors, go to a project and open the Contractors tab.{" "}
        <Link href="/projects" style={{ color: "var(--accent)", textDecoration: "none" }}>
          View projects <ExternalLink size={10} style={{ display: "inline" }} />
        </Link>
      </p>
    </div>
  );
}
