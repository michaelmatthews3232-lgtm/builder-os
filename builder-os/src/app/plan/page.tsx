"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Goal, GoalType, PlanItem, PlanItemStatus } from "@/lib/types";
import {
  Sparkles, Plus, X, Check, Loader2, Target, Zap,
  ChevronDown, UserCircle, RotateCcw, Trash2,
} from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";

function getWeekStart(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

function getWeekLabel(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sunday = addDays(monday, 6);
  return `${format(monday, "MMM d")} – ${format(sunday, "MMM d, yyyy")}`;
}

const PRIORITY_COLOR = (p: number) =>
  p <= 3 ? "#f87171" : p <= 6 ? "#fbbf24" : "var(--text-muted)";

const STATUS_STYLES: Record<PlanItemStatus, { label: string; color: string; bg: string }> = {
  todo: { label: "To Do", color: "var(--text-muted)", bg: "transparent" },
  done: { label: "Done", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  outsourced: { label: "Outsourced", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
};

export default function PlanPage() {
  const weekStart = getWeekStart();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [allContractors, setAllContractors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // Goal form state
  const [newGoalText, setNewGoalText] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>("short_term");
  const [addingGoal, setAddingGoal] = useState(false);

  // Outsource modal state
  const [outsourcingId, setOutsourcingId] = useState<string | null>(null);
  const [outsourceName, setOutsourceName] = useState("");

  const fetchAll = useCallback(async () => {
    const [{ data: goalData }, { data: planData }, { data: contractorData }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: true }),
      supabase.from("plan_items").select("*").eq("week_start", weekStart).order("priority"),
      supabase.from("contractors").select("name").eq("status", "active"),
    ]);
    setGoals((goalData as Goal[]) ?? []);
    setPlanItems((planData as PlanItem[]) ?? []);
    setAllContractors((contractorData ?? []).map((c: { name: string }) => c.name));
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addGoal = async () => {
    if (!newGoalText.trim()) return;
    await supabase.from("goals").insert({ title: newGoalText.trim(), type: newGoalType });
    setNewGoalText("");
    setAddingGoal(false);
    fetchAll();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    fetchAll();
  };

  const generatePlan = async () => {
    setGenerating(true);
    setGenerateError("");

    try {
      // Gather all data to send
      const [{ data: projects }, { data: tasks }] = await Promise.all([
        supabase.from("projects").select("name, status, revenue_monthly").neq("status", "archived"),
        supabase
          .from("tasks")
          .select("title, priority, status, project_id, projects(name)")
          .neq("status", "done"),
      ]);

      const projectList = (projects ?? []).map((p: { name: string; status: string; revenue_monthly: number }) => ({
        name: p.name,
        status: p.status,
        revenue_monthly: p.revenue_monthly,
        open_task_count: (tasks ?? []).filter(
          (t: { project_id?: string }) => t.project_id === (projects ?? []).find((pr: { name: string }) => pr.name === p.name)
        ).length,
      }));

      const taskList = (tasks ?? []).map((t: { title: string; priority: string; status: string; projects?: { name: string } | null }) => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        project: (t.projects as { name: string } | null)?.name ?? "Unknown",
      }));

      const shortTermGoals = goals.filter((g) => g.type === "short_term").map((g) => g.title);
      const longTermGoals = goals.filter((g) => g.type === "long_term").map((g) => g.title);

      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: projectList, tasks: taskList, shortTermGoals, longTermGoals }),
      });

      const { items, error } = await res.json();
      if (error) throw new Error(error);

      // Delete existing plan for this week and insert new
      await supabase.from("plan_items").delete().eq("week_start", weekStart);
      if (items?.length) {
        await supabase.from("plan_items").insert(
          items.map((item: { title: string; description?: string; project_name?: string; priority: number }) => ({
            week_start: weekStart,
            title: item.title,
            description: item.description ?? null,
            project_name: item.project_name ?? null,
            priority: item.priority ?? 5,
            status: "todo",
          }))
        );
      }
      fetchAll();
    } catch (err) {
      console.error(err);
      setGenerateError("Generation failed. Check your Anthropic API key in Vercel env vars.");
    }

    setGenerating(false);
  };

  const updateStatus = async (id: string, status: PlanItemStatus) => {
    await supabase.from("plan_items").update({ status }).eq("id", id);
    setPlanItems((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  };

  const saveOutsource = async (id: string) => {
    const name = outsourceName.trim();
    if (!name) return;
    await supabase.from("plan_items").update({ status: "outsourced", outsource_to: name }).eq("id", id);
    setPlanItems((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: "outsourced", outsource_to: name } : p)
    );
    setOutsourcingId(null);
    setOutsourceName("");
  };

  const deletePlanItem = async (id: string) => {
    await supabase.from("plan_items").delete().eq("id", id);
    setPlanItems((prev) => prev.filter((p) => p.id !== id));
  };

  const shortTermGoals = goals.filter((g) => g.type === "short_term");
  const longTermGoals = goals.filter((g) => g.type === "long_term");
  const todoItems = planItems.filter((p) => p.status === "todo");
  const doneItems = planItems.filter((p) => p.status === "done");
  const outsourcedItems = planItems.filter((p) => p.status === "outsourced");
  const completionPct = planItems.length
    ? Math.round(((doneItems.length + outsourcedItems.length) / planItems.length) * 100)
    : 0;

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            Weekly Game Plan
          </h1>
          <p className="font-mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {getWeekLabel()}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={generatePlan}
          disabled={generating}
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
        >
          {generating ? (
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Sparkles size={14} />
          )}
          {generating ? "Generating..." : planItems.length ? "Regenerate Plan" : "Generate This Week's Plan"}
        </button>
      </div>

      {generateError && (
        <div style={{ fontSize: 12, color: "#f87171", padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 7, border: "1px solid rgba(248,113,113,0.2)" }}>
          {generateError}
        </div>
      )}

      {/* Goals Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {(["short_term", "long_term"] as GoalType[]).map((type) => {
          const isShort = type === "short_term";
          const list = isShort ? shortTermGoals : longTermGoals;
          return (
            <div key={type} className="card" style={{ padding: 18 }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isShort ? <Zap size={13} style={{ color: "#fbbf24" }} /> : <Target size={13} style={{ color: "var(--accent)" }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {isShort ? "Short-Term Goals" : "Long-Term Goals"}
                  </span>
                </div>
                <button
                  style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                  onClick={() => { setAddingGoal(true); setNewGoalType(type); }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {addingGoal && newGoalType === type && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input
                    className="input-base"
                    placeholder={isShort ? "e.g. Launch Candor beta" : "e.g. Hit $5k MRR"}
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addGoal(); if (e.key === "Escape") setAddingGoal(false); }}
                    style={{ fontSize: 12, flex: 1 }}
                    autoFocus
                  />
                  <button className="btn-primary" style={{ padding: "6px 10px" }} onClick={addGoal}><Check size={13} /></button>
                  <button className="btn-ghost" style={{ padding: "6px 10px" }} onClick={() => setAddingGoal(false)}><X size={13} /></button>
                </div>
              )}

              {list.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  {isShort ? "Add your goals for this week or month." : "Add your big-picture goals."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {list.map((g) => (
                    <div key={g.id} className="flex items-center gap-2" style={{ padding: "5px 0" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: isShort ? "#fbbf24" : "var(--accent)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.4 }}>{g.title}</span>
                      <button
                        onClick={() => deleteGoal(g.id)}
                        style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.5, flexShrink: 0 }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Plan Items */}
      {planItems.length === 0 ? (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <Sparkles size={28} style={{ color: "var(--accent)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
            No plan for this week yet
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 340, margin: "0 auto 20px" }}>
            Add your goals above, then click &quot;Generate This Week&apos;s Plan&quot; — Claude will analyze your projects and tasks and build a prioritized action list.
          </p>
          <button className="btn-primary" onClick={generatePlan} disabled={generating} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} />
            Generate Plan
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Week Progress
              </span>
              <span className="font-mono" style={{ fontSize: 12, color: completionPct === 100 ? "#34d399" : "var(--text-muted)" }}>
                {doneItems.length + outsourcedItems.length} / {planItems.length} complete — {completionPct}%
              </span>
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${completionPct}%`, background: completionPct === 100 ? "#34d399" : "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Todo items */}
          {todoItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  This Week — {todoItems.length} remaining
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {todoItems.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    contractors={allContractors}
                    outsourcingId={outsourcingId}
                    outsourceName={outsourceName}
                    onSetOutsourcing={(id) => { setOutsourcingId(id); setOutsourceName(""); }}
                    onOutsourceNameChange={setOutsourceName}
                    onSaveOutsource={saveOutsource}
                    onCancelOutsource={() => { setOutsourcingId(null); setOutsourceName(""); }}
                    onStatusChange={updateStatus}
                    onDelete={deletePlanItem}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Outsourced items */}
          {outsourcedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Outsourced — {outsourcedItems.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {outsourcedItems.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    contractors={allContractors}
                    outsourcingId={outsourcingId}
                    outsourceName={outsourceName}
                    onSetOutsourcing={(id) => { setOutsourcingId(id); setOutsourceName(""); }}
                    onOutsourceNameChange={setOutsourceName}
                    onSaveOutsource={saveOutsource}
                    onCancelOutsource={() => { setOutsourcingId(null); setOutsourceName(""); }}
                    onStatusChange={updateStatus}
                    onDelete={deletePlanItem}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Done items */}
          {doneItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Done — {doneItems.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {doneItems.map((item) => (
                  <PlanItemRow
                    key={item.id}
                    item={item}
                    contractors={allContractors}
                    outsourcingId={outsourcingId}
                    outsourceName={outsourceName}
                    onSetOutsourcing={(id) => { setOutsourcingId(id); setOutsourceName(""); }}
                    onOutsourceNameChange={setOutsourceName}
                    onSaveOutsource={saveOutsource}
                    onCancelOutsource={() => { setOutsourcingId(null); setOutsourceName(""); }}
                    onStatusChange={updateStatus}
                    onDelete={deletePlanItem}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="btn-ghost"
              onClick={generatePlan}
              disabled={generating}
              style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
            >
              <RotateCcw size={12} />
              Regenerate Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanItemRow({
  item,
  contractors,
  outsourcingId,
  outsourceName,
  onSetOutsourcing,
  onOutsourceNameChange,
  onSaveOutsource,
  onCancelOutsource,
  onStatusChange,
  onDelete,
}: {
  item: PlanItem;
  contractors: string[];
  outsourcingId: string | null;
  outsourceName: string;
  onSetOutsourcing: (id: string) => void;
  onOutsourceNameChange: (name: string) => void;
  onSaveOutsource: (id: string) => void;
  onCancelOutsource: () => void;
  onStatusChange: (id: string, status: PlanItemStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isDone = item.status === "done";
  const isOutsourced = item.status === "outsourced";
  const showOutsourceForm = outsourcingId === item.id;
  const sc = STATUS_STYLES[item.status];

  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        opacity: isDone ? 0.55 : 1,
        borderColor: isOutsourced ? "rgba(129,140,248,0.2)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onStatusChange(item.id, isDone ? "todo" : "done")}
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            border: `2px solid ${isDone ? "#34d399" : "var(--border)"}`,
            background: isDone ? "#34d399" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
            cursor: "pointer",
            transition: "all 0.12s",
          }}
        >
          {isDone && <Check size={11} color="#0a0d14" strokeWidth={3} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text-primary)",
                textDecoration: isDone ? "line-through" : "none",
                lineHeight: 1.3,
              }}
            >
              {item.title}
            </span>
            {item.project_name && (
              <span style={{ fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 7px", borderRadius: 4, fontWeight: 600, whiteSpace: "nowrap" }}>
                {item.project_name}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR(item.priority), fontFamily: "JetBrains Mono, monospace" }}>
              P{item.priority}
            </span>
          </div>

          {item.description && !isDone && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 6 }}>
              {item.description}
            </p>
          )}

          {/* Outsource info */}
          {isOutsourced && item.outsource_to && (
            <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
              <UserCircle size={11} style={{ color: "#818cf8" }} />
              <span style={{ fontSize: 11, color: "#818cf8" }}>Assigned to {item.outsource_to}</span>
            </div>
          )}

          {/* Outsource form */}
          {showOutsourceForm && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {contractors.length > 0 ? (
                <select
                  className="input-base"
                  style={{ fontSize: 12, padding: "5px 10px", flex: 1 }}
                  value={outsourceName}
                  onChange={(e) => onOutsourceNameChange(e.target.value)}
                >
                  <option value="">Select contractor...</option>
                  {contractors.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">Other (type name)</option>
                </select>
              ) : (
                <input
                  className="input-base"
                  style={{ fontSize: 12, padding: "5px 10px", flex: 1 }}
                  placeholder="Contractor name..."
                  value={outsourceName}
                  onChange={(e) => onOutsourceNameChange(e.target.value)}
                  autoFocus
                />
              )}
              {outsourceName === "__custom__" && (
                <input
                  className="input-base"
                  style={{ fontSize: 12, padding: "5px 10px", flex: 1 }}
                  placeholder="Enter name..."
                  value={outsourceName === "__custom__" ? "" : outsourceName}
                  onChange={(e) => onOutsourceNameChange(e.target.value)}
                  autoFocus
                />
              )}
              <button className="btn-primary" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => onSaveOutsource(item.id)}>
                Assign
              </button>
              <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={onCancelOutsource}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          {!isDone && !isOutsourced && !showOutsourceForm && (
            <button
              onClick={() => onSetOutsourcing(item.id)}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 5,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              <ChevronDown size={10} /> Outsource
            </button>
          )}
          {isOutsourced && (
            <button
              onClick={() => onStatusChange(item.id, "todo")}
              title="Move back to To Do"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
