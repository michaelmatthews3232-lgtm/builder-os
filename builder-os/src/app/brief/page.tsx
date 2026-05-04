"use client";

import { useState } from "react";
import {
  Brain,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Zap,
  Target,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface Opportunity {
  title: string;
  action: string;
  impact: "high" | "medium";
}

interface Brief {
  health_score: number;
  health_reasoning: string;
  summary: string;
  revenue_analysis: string;
  alerts: string[];
  opportunities: Opportunity[];
  bottlenecks: string[];
  this_week: string[];
  project_spotlight: { name: string; insight: string };
}

function healthColor(score: number): string {
  if (score >= 8) return "#34d399";
  if (score >= 6) return "#fbbf24";
  if (score >= 4) return "#fb923c";
  return "#f87171";
}

export default function BriefPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-brief", { method: "POST" });
      const body = await res.json();
      if (!res.ok || body.error) {
        setError(body.error ?? "Generation failed");
      } else {
        setBrief(body.brief);
        setGeneratedAt(body.generated_at);
      }
    } catch {
      setError("Network error — check your connection");
    }
    setLoading(false);
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={20} style={{ color: "var(--accent)" }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>AI Brief</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Claude Opus reviews every project, sale, task, and payment — then tells you exactly what matters.
            {generatedAt && (
              <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                Last run {format(parseISO(generatedAt), "MMM d 'at' h:mm a")}
              </span>
            )}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={generate}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 7 }}
        >
          {loading
            ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            : brief ? <RefreshCw size={14} /> : <Sparkles size={14} />}
          {loading ? "Analyzing..." : brief ? "Refresh" : "Generate Brief"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!brief && !loading && !error && (
        <div className="card" style={{ padding: "60px 40px", textAlign: "center" }}>
          <Brain size={40} style={{ color: "var(--accent)", margin: "0 auto 16px", opacity: 0.5 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            Your business, analyzed
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.7 }}>
            Pulls every project, task, finance snapshot, sales lead, contractor, and live data from
            Stripe and Gumroad — then gives you a sharp business brief with a health score,
            revenue analysis, alerts, and exactly what to do this week.
          </p>
          <button className="btn-primary" onClick={generate} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Sparkles size={14} /> Generate My Brief
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[80, 120, 100, 90].map((h, i) => (
            <div key={i} className="card" style={{ height: h, background: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.1)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            Claude Opus is reviewing your business — usually 10–20 seconds
          </p>
        </div>
      )}

      {/* Brief content */}
      {brief && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Health score + summary */}
          <div className="card" style={{ padding: "24px 28px", display: "flex", gap: 28, alignItems: "flex-start", borderColor: `${healthColor(brief.health_score)}25` }}>
            <div style={{ flexShrink: 0, textAlign: "center" }}>
              <div
                className="font-mono"
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: healthColor(brief.health_score),
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {brief.health_score}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                /10
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>
                Health Score
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {brief.health_reasoning}
              </p>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {brief.summary}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

            {/* Alerts */}
            <div className="card" style={{ padding: "20px 22px", borderColor: "rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.02)" }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={13} style={{ color: "#f87171" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Alerts
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {brief.alerts.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171", flexShrink: 0, marginTop: 1 }}>!</span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* This week */}
            <div className="card" style={{ padding: "20px 22px", borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.02)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={13} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  This Week
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {brief.this_week.map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--accent)",
                        background: "var(--accent-dim)",
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500 }}>{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue analysis */}
            <div className="card" style={{ padding: "20px 22px" }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={13} style={{ color: "#34d399" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Revenue Analysis
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                {brief.revenue_analysis}
              </p>
            </div>

            {/* Bottlenecks */}
            <div className="card" style={{ padding: "20px 22px", borderColor: "rgba(251,191,36,0.15)", background: "rgba(251,191,36,0.02)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={13} style={{ color: "#fbbf24" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Bottlenecks
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {brief.bottlenecks.map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <ChevronRight size={13} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opportunities */}
          <div className="card" style={{ padding: "20px 22px" }}>
            <div className="flex items-center gap-2 mb-4">
              <Target size={13} style={{ color: "#a78bfa" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Opportunities
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${brief.opportunities.length}, 1fr)`, gap: 12 }}>
              {brief.opportunities.map((opp, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    background: "rgba(167,139,250,0.06)",
                    border: "1px solid rgba(167,139,250,0.18)",
                    borderRadius: 10,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{opp.title}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: opp.impact === "high" ? "#34d399" : "#fbbf24",
                        background: opp.impact === "high" ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      {opp.impact}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>{opp.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Project spotlight */}
          <div
            className="card"
            style={{
              padding: "18px 22px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "rgba(99,102,241,0.04)",
              borderColor: "rgba(99,102,241,0.2)",
            }}
          >
            <Sparkles size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Project Spotlight — {brief.project_spotlight.name}
              </span>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
                {brief.project_spotlight.insight}
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
