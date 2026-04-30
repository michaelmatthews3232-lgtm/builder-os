"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { NewTaskModal } from "@/components/NewTaskModal";
import type { Project, Task, Contractor, BlockedReason } from "@/lib/types";
import { BLOCKER_REASON_CONFIG } from "@/lib/types";
import { format, isPast, isToday, parseISO, differenceInDays } from "date-fns";
import {
  Zap,
  CheckCircle2,
  UserCheck,
  Ban,
  Plus,
  Sparkles,
  Loader2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  X,
  AlertTriangle,
} from "lucide-react";

const STATUS_W: Record<string, number> = {
  monetizing: 1, scaling: 2, building: 3, planned: 4, idea: 5, archived: 99,
};
const PRIORITY_W: Record<string, number> = { high: 1, medium: 2, low: 3 };
const PRIORITY_COLOR: Record<string, string> = { high: "#f87171", medium: "#fbbf24", low: "#6b7280" };

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = a.due_date && isPast(parseISO(a.due_date)) && !isToday(parseISO(a.due_date));
    const bOverdue = b.due_date && isPast(parseISO(b.due_date)) && !isToday(parseISO(b.due_date));
    const aToday = a.due_date && isToday(parseISO(a.due_date));
    const bToday = b.due_date && isToday(parseISO(b.due_date));
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aToday && !bToday) return -1;
    if (!aToday && bToday) return 1;
    const statusDiff = (STATUS_W[a.project?.status ?? "idea"] ?? 5) - (STATUS_W[b.project?.status ?? "idea"] ?? 5);
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = (PRIORITY_W[a.priority] ?? 2) - (PRIORITY_W[b.priority] ?? 2);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Focus step generation
  const [focusSteps, setFocusSteps] = useState<string[] | null>(null);
  const [focusWhy, setFocusWhy] = useState("");
  const [focusTime, setFocusTime] = useState("");
  const [generatingSteps, setGeneratingSteps] = useState(false);

  // Action UI state
  const [showOutsource, setShowOutsource] = useState(false);
  const [showBlockedInput, setShowBlockedInput] = useState(false);
  const [blockedNote, setBlockedNote] = useState("");
  const [blockedReason, setBlockedReason] = useState<BlockedReason>("other");
  const [actioning, setActioning] = useState(false);
  const [showBlockedTasks, setShowBlockedTasks] = useState(false);
  const [stepsChecked, setStepsChecked] = useState<Set<number>>(new Set());

  const fetchData = async () => {
    const [{ data: tasksData }, { data: projectsData }, { data: contractorsData }] = await Promise.all([
      supabase.from("tasks").select("*, project:projects(id, name, status)").neq("status", "done"),
      supabase.from("projects").select("*"),
      supabase.from("contractors").select("*").neq("status", "inactive"),
    ]);
    setTasks((tasksData as Task[]) ?? []);
    setProjects((projectsData as Project[]) ?? []);
    setContractors((contractorsData as Contractor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const sorted = sortTasks(tasks);
  const activeTasks = sorted.filter((t) => !t.is_blocked);
  const blockedTasks = sorted.filter((t) => t.is_blocked);

  // Focus = first self-assigned active task, or first active task
  const focusTask = activeTasks.find((t) => t.assigned_to === "self" || !t.assigned_to) ?? activeTasks[0] ?? null;
  const queueTasks = activeTasks.filter((t) => t.id !== focusTask?.id);

  // Reset steps when focus task changes
  useEffect(() => {
    setFocusSteps(null);
    setFocusWhy("");
    setFocusTime("");
    setShowOutsource(false);
    setShowBlockedInput(false);
    setStepsChecked(new Set());
  }, [focusTask?.id]);

  const generateSteps = async () => {
    if (!focusTask) return;
    setGeneratingSteps(true);
    try {
      const res = await fetch("/api/generate-focus-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: focusTask.title,
          description: focusTask.description,
          projectName: focusTask.project?.name ?? "",
          projectStatus: focusTask.project?.status ?? "",
        }),
      });
      const body = await res.json();
      if (body.steps) {
        setFocusSteps(body.steps);
        setFocusWhy(body.why_important ?? "");
        setFocusTime(body.estimated_time ?? "");
      }
    } finally {
      setGeneratingSteps(false);
    }
  };

  const markFocusDone = async () => {
    if (!focusTask) return;
    setActioning(true);
    await supabase.from("tasks").update({ status: "done" }).eq("id", focusTask.id);
    await fetchData();
    setActioning(false);
  };

  const outsourceTask = async (contractorName: string) => {
    if (!focusTask) return;
    setActioning(true);
    await supabase.from("tasks").update({ assigned_to: contractorName, status: "in_progress" }).eq("id", focusTask.id);
    setShowOutsource(false);
    await fetchData();
    setActioning(false);
  };

  const markBlocked = async () => {
    if (!focusTask || !blockedNote.trim()) return;
    setActioning(true);
    await supabase.from("tasks").update({
      is_blocked: true,
      blocked_reason: blockedReason,
      blocked_notes: blockedNote.trim(),
    }).eq("id", focusTask.id);
    setShowBlockedInput(false);
    setBlockedNote("");
    await fetchData();
    setActioning(false);
  };

  const unblock = async (taskId: string) => {
    await supabase.from("tasks").update({ is_blocked: false, blocked_reason: null, blocked_notes: null }).eq("id", taskId);
    fetchData();
  };

  const markQueueDone = async (taskId: string) => {
    await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    fetchData();
  };

  const toggleStep = (i: number) => {
    setStepsChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const overdueCount = activeTasks.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  ).length;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={20} style={{ color: "var(--accent)" }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Today</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {format(new Date(), "EEEE, MMMM d")}
            {!loading && (
              <>
                <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>·</span>
                <span>{activeTasks.length} in queue</span>
                {overdueCount > 0 && (
                  <span style={{ color: "#f87171", marginLeft: 8, fontWeight: 600 }}>
                    · {overdueCount} overdue
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
          Quick Task
        </button>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : !focusTask ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <CheckCircle2 size={36} style={{ color: "var(--accent)", margin: "0 auto 14px" }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Clear queue.</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            No open tasks. Add something to execute on.
          </p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>Add Task</button>
        </div>
      ) : (
        <>
          {/* ── Focus Card ── */}
          <div
            style={{
              background: "rgba(99,102,241,0.04)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 14,
              padding: "24px 28px",
              position: "relative",
            }}
          >
            {/* Label */}
            <div className="flex items-center gap-2 mb-4">
              <Zap size={11} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Today&apos;s Focus
              </span>
              {focusTask.due_date && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isPast(parseISO(focusTask.due_date)) && !isToday(parseISO(focusTask.due_date))
                      ? "#f87171"
                      : isToday(parseISO(focusTask.due_date))
                      ? "var(--accent)"
                      : "var(--text-muted)",
                    marginLeft: "auto",
                  }}
                >
                  {isToday(parseISO(focusTask.due_date))
                    ? "DUE TODAY"
                    : isPast(parseISO(focusTask.due_date))
                    ? "OVERDUE"
                    : `Due ${format(parseISO(focusTask.due_date), "MMM d")}`}
                </span>
              )}
            </div>

            {/* Task title */}
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 10 }}>
              {focusTask.title}
            </h2>

            {/* Description */}
            {focusTask.description && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                {focusTask.description}
              </p>
            )}

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 20 }}>
              {focusTask.project && (
                <Link
                  href={`/projects/${focusTask.project_id}`}
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                    fontFamily: "JetBrains Mono, monospace",
                    background: "rgba(255,255,255,0.05)",
                    padding: "3px 9px",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {focusTask.project.name}
                  <ArrowRight size={9} />
                </Link>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: PRIORITY_COLOR[focusTask.priority],
                  background: `${PRIORITY_COLOR[focusTask.priority]}18`,
                  padding: "3px 9px",
                  borderRadius: 5,
                  fontFamily: "JetBrains Mono, monospace",
                  textTransform: "uppercase",
                }}
              >
                {focusTask.priority}
              </span>
              {focusTask.project && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    background: "rgba(255,255,255,0.04)",
                    padding: "3px 9px",
                    borderRadius: 5,
                    textTransform: "capitalize",
                  }}
                >
                  {focusTask.project.status}
                </span>
              )}
            </div>

            {/* AI Steps */}
            {!focusSteps ? (
              <button
                onClick={generateSteps}
                disabled={generatingSteps}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 16px",
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: 8,
                  color: "var(--accent)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: generatingSteps ? "wait" : "pointer",
                  marginBottom: 20,
                  transition: "all 0.12s",
                }}
              >
                {generatingSteps ? (
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Sparkles size={14} />
                )}
                {generatingSteps ? "Generating steps..." : "Get AI Step-by-Step Instructions"}
              </button>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {/* Why + time */}
                {focusWhy && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      fontStyle: "italic",
                      marginBottom: 12,
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 7,
                      borderLeft: "2px solid rgba(99,102,241,0.4)",
                    }}
                  >
                    {focusWhy}
                    {focusTime && (
                      <span style={{ marginLeft: 10, color: "var(--accent)", fontStyle: "normal", fontWeight: 600 }}>
                        <Clock size={10} style={{ display: "inline", marginRight: 3 }} />
                        {focusTime}
                      </span>
                    )}
                  </div>
                )}

                {/* Steps checklist */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {focusSteps.map((step, i) => (
                    <button
                      key={i}
                      onClick={() => toggleStep(i)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "9px 12px",
                        background: stepsChecked.has(i) ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${stepsChecked.has(i) ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 8,
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                        transition: "all 0.12s",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          border: `1.5px solid ${stepsChecked.has(i) ? "#34d399" : "rgba(255,255,255,0.2)"}`,
                          background: stepsChecked.has(i) ? "rgba(52,211,153,0.2)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: stepsChecked.has(i) ? "#34d399" : "var(--text-muted)",
                          marginTop: 1,
                        }}
                      >
                        {stepsChecked.has(i) ? "✓" : i + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: stepsChecked.has(i) ? "var(--text-muted)" : "var(--text-primary)",
                          lineHeight: 1.5,
                          textDecoration: stepsChecked.has(i) ? "line-through" : "none",
                          flex: 1,
                        }}
                      >
                        {step}
                      </span>
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                  {stepsChecked.size}/{focusSteps.length} steps done
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!showOutsource && !showBlockedInput && (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={markFocusDone}
                  disabled={actioning}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 20px",
                    background: "rgba(52,211,153,0.12)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    borderRadius: 8,
                    color: "#34d399",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: actioning ? "wait" : "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <CheckCircle2 size={15} />
                  Mark Done
                </button>

                <button
                  onClick={() => setShowOutsource(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 20px",
                    background: "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.25)",
                    borderRadius: 8,
                    color: "#60a5fa",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <UserCheck size={15} />
                  Outsource
                </button>

                <button
                  onClick={() => setShowBlockedInput(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 20px",
                    background: "rgba(251,191,36,0.08)",
                    border: "1px solid rgba(251,191,36,0.22)",
                    borderRadius: 8,
                    color: "#fbbf24",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <Ban size={15} />
                  Can&apos;t Do Right Now
                </button>
              </div>
            )}

            {/* Outsource picker */}
            {showOutsource && (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Who&apos;s handling this?
                  </span>
                  <button onClick={() => setShowOutsource(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                    <X size={14} />
                  </button>
                </div>
                {contractors.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    No active contractors.{" "}
                    <Link href="/contractors" style={{ color: "var(--accent)" }}>Add one →</Link>
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {contractors.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => outsourceTask(c.name)}
                        disabled={actioning}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border)",
                          borderRadius: 7,
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                          transition: "all 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "rgba(96,165,250,0.4)";
                          (e.currentTarget as HTMLElement).style.background = "rgba(96,165,250,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                          {c.role && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.role}</div>}
                        </div>
                        <ArrowRight size={13} style={{ color: "#60a5fa" }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Can't Do input */}
            {showBlockedInput && (
              <div
                style={{
                  background: "rgba(251,191,36,0.05)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fbbf24" }}>What&apos;s blocking this?</span>
                  <button onClick={() => { setShowBlockedInput(false); setBlockedNote(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Reason category */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {(Object.keys(BLOCKER_REASON_CONFIG) as BlockedReason[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setBlockedReason(key)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        border: `1px solid ${blockedReason === key ? BLOCKER_REASON_CONFIG[key].color : "var(--border)"}`,
                        background: blockedReason === key ? `${BLOCKER_REASON_CONFIG[key].color}18` : "transparent",
                        color: blockedReason === key ? BLOCKER_REASON_CONFIG[key].color : "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                    >
                      {BLOCKER_REASON_CONFIG[key].label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={blockedNote}
                  onChange={(e) => setBlockedNote(e.target.value)}
                  placeholder="What specifically is blocking you? (e.g. 'Need $200 for API credits', 'Waiting on client approval')"
                  rows={2}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    resize: "vertical",
                    fontFamily: "inherit",
                    marginBottom: 10,
                    boxSizing: "border-box",
                  }}
                />

                <button
                  onClick={markBlocked}
                  disabled={!blockedNote.trim() || actioning}
                  style={{
                    padding: "8px 18px",
                    background: blockedNote.trim() ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${blockedNote.trim() ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
                    borderRadius: 7,
                    color: blockedNote.trim() ? "#fbbf24" : "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: blockedNote.trim() ? "pointer" : "not-allowed",
                    transition: "all 0.12s",
                  }}
                >
                  {actioning ? "Saving..." : "Park This Task"}
                </button>
              </div>
            )}
          </div>

          {/* ── Queue ── */}
          {queueTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Queue
                </span>
                <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{queueTasks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {queueTasks.map((task) => (
                  <QueueRow key={task.id} task={task} onDone={markQueueDone} />
                ))}
              </div>
            </div>
          )}

          {/* ── Blocked ── */}
          {blockedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowBlockedTasks((v) => !v)}
                className="flex items-center gap-2"
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 10px" }}
              >
                <AlertTriangle size={12} style={{ color: "#fbbf24" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Blocked
                </span>
                <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{blockedTasks.length}</span>
                {showBlockedTasks ? (
                  <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                ) : (
                  <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
                )}
              </button>

              {showBlockedTasks && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {blockedTasks.map((task) => (
                    <BlockedRow key={task.id} task={task} onUnblock={unblock} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showModal && (
        <NewTaskModal
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          onClose={() => setShowModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}

function QueueRow({ task, onDone }: { task: Task; onDone: (id: string) => void }) {
  const [completing, setCompleting] = useState(false);
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && isToday(parseISO(task.due_date));

  const handle = async () => {
    setCompleting(true);
    await onDone(task.id);
  };

  return (
    <div
      className="card"
      style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderColor: isOverdue ? "rgba(248,113,113,0.15)" : isDueToday ? "rgba(99,102,241,0.15)" : undefined,
      }}
    >
      <button
        onClick={handle}
        disabled={completing}
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${task.priority === "high" ? "#f87171" : "rgba(255,255,255,0.15)"}`,
          background: completing ? "var(--accent-dim)" : "transparent",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.12)";
          (e.currentTarget as HTMLElement).style.borderColor = "#34d399";
        }}
        onMouseLeave={(e) => {
          if (!completing) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = task.priority === "high" ? "#f87171" : "rgba(255,255,255,0.15)";
          }
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{task.title}</span>
        {task.project && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, fontFamily: "JetBrains Mono, monospace" }}>
            {task.project.name}
          </span>
        )}
        {task.assigned_to && task.assigned_to !== "self" && (
          <span style={{ fontSize: 11, color: "#60a5fa", marginLeft: 8 }}>→ {task.assigned_to}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: PRIORITY_COLOR[task.priority],
            fontFamily: "JetBrains Mono, monospace",
            textTransform: "uppercase",
          }}
        >
          {task.priority}
        </span>
        {task.due_date && (
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: isOverdue ? "#f87171" : isDueToday ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {isDueToday
              ? "TODAY"
              : isOverdue
              ? "OVERDUE"
              : (() => {
                  const days = differenceInDays(parseISO(task.due_date!), new Date());
                  return `${days}d`;
                })()}
          </span>
        )}
      </div>
    </div>
  );
}

function BlockedRow({ task, onUnblock }: { task: Task; onUnblock: (id: string) => void }) {
  const config = task.blocked_reason ? BLOCKER_REASON_CONFIG[task.blocked_reason] : null;

  return (
    <div
      className="card"
      style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderColor: "rgba(251,191,36,0.12)",
        background: "rgba(251,191,36,0.02)",
        opacity: 0.85,
      }}
    >
      <AlertTriangle size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{task.title}</span>
        {task.blocked_notes && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {config && (
              <span style={{ color: config.color, fontWeight: 600, marginRight: 5 }}>{config.label}:</span>
            )}
            {task.blocked_notes}
          </div>
        )}
      </div>
      <button
        onClick={() => onUnblock(task.id)}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 5,
          padding: "4px 10px",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "#34d399";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        }}
      >
        Unblock
      </button>
    </div>
  );
}
