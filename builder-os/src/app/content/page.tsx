"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wand2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  ShoppingBag,
  Package,
  ExternalLink,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type JobStatus = "pending" | "processing" | "done" | "failed" | "approved" | "published";

interface JobResult {
  url: string;
  template: string;
  score: number;
  pass: boolean;
  best_use: string;
}

interface ContentJob {
  id: string;
  project_id: string | null;
  status: JobStatus;
  product_type: string;
  brief: string;
  reference_image_url: string | null;
  results: JobResult[];
  approved_images: string[];
  published_to: {
    etsy?: { listing_id: string; url?: string };
    gumroad?: { product_id: string; url?: string };
  };
  error: string | null;
  created_at: string;
  project?: { name: string };
}

interface Project {
  id: string;
  name: string;
  status: string;
}

const PRODUCT_TYPES = [
  { value: "soap", label: "Soap", emoji: "🧼" },
  { value: "candle", label: "Candle", emoji: "🕯️" },
  { value: "jewelry", label: "Jewelry", emoji: "💍" },
  { value: "staging", label: "Staging", emoji: "🏠" },
];

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string }> = {
  pending: { label: "Queued", color: "#94a3b8" },
  processing: { label: "Generating", color: "#fbbf24" },
  done: { label: "Ready to Review", color: "#34d399" },
  failed: { label: "Failed", color: "#f87171" },
  approved: { label: "Approved", color: "#6366f1" },
  published: { label: "Published", color: "#a78bfa" },
};

function ScoreBadge({ score, pass }: { score: number; pass: boolean }) {
  const color = pass ? "#34d399" : "#f87171";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 5px",
        borderRadius: 4,
        color,
        background: `${color}18`,
        letterSpacing: "0.04em",
      }}
    >
      {score?.toFixed(1) ?? "?"}
    </span>
  );
}

export default function ContentPage() {
  const [jobs, setJobs] = useState<ContentJob[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [form, setForm] = useState({
    project_id: "",
    product_type: "soap",
    brief: "",
    reference_image_url: "",
  });

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/content/jobs");
    if (res.ok) setJobs(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/content/jobs").then((r) => r.json()),
      supabase.from("projects").select("id, name, status").neq("status", "archived").order("name"),
    ]).then(([jobsData, { data: projectsData }]) => {
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setProjects(projectsData ?? []);
      setLoadingJobs(false);
    });
  }, []);

  // Poll while any job is processing
  useEffect(() => {
    const active = jobs.some((j) => j.status === "pending" || j.status === "processing");
    if (!active) return;
    const timer = setInterval(fetchJobs, 5000);
    return () => clearInterval(timer);
  }, [jobs, fetchJobs]);

  const submit = async () => {
    if (!form.brief.trim()) return;
    setCreating(true);
    const res = await fetch("/api/content/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: form.project_id || null,
        product_type: form.product_type,
        brief: form.brief,
        reference_image_url: form.reference_image_url || null,
      }),
    });
    if (res.ok) {
      const job = await res.json();
      setJobs((prev) => [job, ...prev]);
      setForm((f) => ({ ...f, brief: "", reference_image_url: "" }));
      setSelectedJob(job.id);
    }
    setCreating(false);
  };

  const toggleApprove = async (job: ContentJob, url: string) => {
    const isApproved = job.approved_images.includes(url);
    const approved_images = isApproved
      ? job.approved_images.filter((u) => u !== url)
      : [...job.approved_images, url];
    const status: JobStatus = approved_images.length > 0 ? "approved" : "done";

    const res = await fetch(`/api/content/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved_images, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
    }
  };

  const publish = async (jobId: string, platform: "etsy" | "gumroad") => {
    setPublishError(null);
    setPublishing(`${jobId}-${platform}`);
    const res = await fetch(`/api/content/jobs/${jobId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    const data = await res.json();
    if (res.ok) {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? data : j)));
    } else {
      setPublishError(data.error ?? "Publish failed");
    }
    setPublishing(null);
  };

  const pendingCount = jobs.filter((j) => j.status === "pending" || j.status === "processing").length;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wand2 size={20} style={{ color: "var(--accent)" }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Content Studio</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Submit product photography jobs — soap-agent generates, QA scores, you approve, then publish to Etsy or Gumroad.
          </p>
        </div>
        {pendingCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <Loader2 size={12} style={{ color: "#fbbf24", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>
              {pendingCount} job{pendingCount !== 1 ? "s" : ""} running — refreshing every 5s
            </span>
          </div>
        )}
      </div>

      {publishError && (
        <div style={{ padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
          <AlertTriangle size={12} style={{ display: "inline", marginRight: 6 }} />
          {publishError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
        {/* Create job form */}
        <div className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            New Generation Job
          </div>

          {/* Project */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Project (optional)
            </label>
            <select
              value={form.project_id}
              onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              className="input"
              style={{ width: "100%", fontSize: 13 }}
            >
              <option value="">— No project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Product Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PRODUCT_TYPES.map((pt) => {
                const active = form.product_type === pt.value;
                return (
                  <button
                    key={pt.value}
                    onClick={() => setForm((f) => ({ ...f, product_type: pt.value }))}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "var(--accent-dim)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{pt.emoji}</span>
                    {pt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brief */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              Product Brief
            </label>
            <textarea
              value={form.brief}
              onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
              placeholder={
                form.product_type === "soap"
                  ? "Lavender oatmeal bar soap, rustic/cozy style, want dried lavender and barnwood backgrounds..."
                  : form.product_type === "candle"
                  ? "Vanilla amber jar candle, cream label, want warm glow scenes with autumn botanicals..."
                  : form.product_type === "staging"
                  ? "Modern farmhouse living room, neutral palette, natural light through windows..."
                  : "Sterling silver ring with moonstone, elegant flatlay photography, soft fabric backgrounds..."
              }
              className="input"
              rows={5}
              style={{ width: "100%", fontSize: 13, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* Reference image URL */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Reference Image URL
            </label>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.5 }}>
              Link to your product photo — upload to Imgur, Dropbox, Google Drive (direct link), or any public URL.
            </p>
            <input
              type="url"
              value={form.reference_image_url}
              onChange={(e) => setForm((f) => ({ ...f, reference_image_url: e.target.value }))}
              placeholder="https://i.imgur.com/..."
              className="input"
              style={{ width: "100%", fontSize: 13 }}
            />
          </div>

          <button
            className="btn-primary"
            onClick={submit}
            disabled={creating || !form.brief.trim()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            {creating ? (
              <>
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Queuing...
              </>
            ) : (
              <>
                <Sparkles size={13} /> Queue Generation Job
              </>
            )}
          </button>

          {/* How it works */}
          <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.04)", borderRadius: 8, border: "1px solid rgba(99,102,241,0.12)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              How it works
            </div>
            {[
              "Job queued → soap-agent picks it up",
              "Generates scenes with Flux Kontext AI",
              "Claude QA scores each image",
              "You approve → publish to Etsy or Gumroad",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < 3 ? 6 : 0 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Jobs list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loadingJobs ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="card" style={{ padding: "56px 24px", textAlign: "center" }}>
              <ImageIcon size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No jobs yet</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Submit your first generation job using the form.</p>
            </div>
          ) : (
            jobs.map((job) => {
              const s = STATUS_CONFIG[job.status];
              const isSelected = selectedJob === job.id;
              const passCount = job.results?.filter((r) => r.pass).length ?? 0;

              return (
                <div key={job.id}>
                  {/* Job card */}
                  <div
                    className="card"
                    onClick={() => setSelectedJob(isSelected ? null : job.id)}
                    style={{
                      padding: "14px 18px",
                      cursor: "pointer",
                      borderColor: isSelected ? "var(--border-accent)" : undefined,
                      background: isSelected ? "rgba(99,102,241,0.03)" : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          borderRadius: 5,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: s.color,
                          background: `${s.color}18`,
                        }}
                      >
                        {(job.status === "processing" || job.status === "pending") && (
                          <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} />
                        )}
                        {job.status === "done" || job.status === "approved" ? <CheckCircle2 size={9} /> : null}
                        {job.status === "failed" ? <XCircle size={9} /> : null}
                        {job.status === "published" ? <Sparkles size={9} /> : null}
                        {s.label}
                      </span>

                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>
                        {PRODUCT_TYPES.find((p) => p.value === job.product_type)?.emoji} {job.product_type}
                      </span>

                      {job.project && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— {job.project.name}</span>
                      )}

                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(job.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      <ChevronRight
                        size={13}
                        style={{
                          color: "var(--text-muted)",
                          transform: isSelected ? "rotate(90deg)" : "none",
                          transition: "transform 0.15s",
                        }}
                      />
                    </div>

                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                      {job.brief.length > 120 ? job.brief.slice(0, 117) + "..." : job.brief}
                    </p>

                    {job.results?.length > 0 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        {job.results.length} images &middot; {passCount} passed QA
                        {job.approved_images?.length > 0 && ` · ${job.approved_images.length} approved`}
                        {job.published_to?.etsy && " · Published to Etsy"}
                        {job.published_to?.gumroad && " · Published to Gumroad"}
                      </p>
                    )}
                  </div>

                  {/* Expanded detail panel */}
                  {isSelected && (
                    <div
                      className="card"
                      style={{ padding: "18px 20px", marginTop: 4, borderColor: "var(--border-accent)" }}
                    >
                      {job.status === "pending" && (
                        <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)" }}>
                          <Clock size={22} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
                          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Waiting for soap-agent</p>
                          <p style={{ fontSize: 12 }}>
                            Run <code style={{ background: "var(--bg-hover)", padding: "1px 6px", borderRadius: 4 }}>python supabase_poller.py</code> in your soap-agent directory to start processing.
                          </p>
                        </div>
                      )}

                      {job.status === "processing" && (
                        <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)" }}>
                          <Loader2 size={22} style={{ margin: "0 auto 10px", animation: "spin 1s linear infinite" }} />
                          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Generating images...</p>
                          <p style={{ fontSize: 12 }}>Flux Kontext is rendering your scenes. This takes 2–4 minutes.</p>
                        </div>
                      )}

                      {job.status === "failed" && (
                        <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.08)", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
                          <AlertTriangle size={13} style={{ display: "inline", marginRight: 6 }} />
                          {job.error ?? "Generation failed — check soap-agent logs"}
                        </div>
                      )}

                      {(job.status === "done" ||
                        job.status === "approved" ||
                        job.status === "published") &&
                        job.results?.length > 0 && (
                          <>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.07em",
                                marginBottom: 12,
                              }}
                            >
                              Review Images — click to approve
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                                gap: 10,
                                marginBottom: 18,
                              }}
                            >
                              {job.results.map((r, i) => {
                                const approved = job.approved_images?.includes(r.url);
                                return (
                                  <div
                                    key={i}
                                    onClick={() => toggleApprove(job, r.url)}
                                    style={{
                                      position: "relative",
                                      borderRadius: 8,
                                      overflow: "hidden",
                                      border: `2px solid ${approved ? "#34d399" : "var(--border)"}`,
                                      cursor: "pointer",
                                      background: "var(--bg-card)",
                                      transition: "border-color 0.12s",
                                    }}
                                  >
                                    <img
                                      src={r.url}
                                      alt={r.template}
                                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                    <div
                                      style={{
                                        padding: "5px 7px",
                                        background: "rgba(0,0,0,0.7)",
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                      }}
                                    >
                                      <div style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "uppercase", marginBottom: 2 }}>
                                        {r.template?.replace(/_/g, " ")}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <ScoreBadge score={r.score} pass={r.pass} />
                                        <span style={{ fontSize: 9, color: "#94a3b8" }}>
                                          {r.best_use?.replace(/_/g, " ")}
                                        </span>
                                      </div>
                                    </div>
                                    {approved && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: 6,
                                          right: 6,
                                          background: "#34d399",
                                          borderRadius: "50%",
                                          width: 20,
                                          height: 20,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <CheckCircle2 size={12} color="#fff" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Publish bar */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                paddingTop: 14,
                                borderTop: "1px solid var(--border)",
                              }}
                            >
                              {job.approved_images?.length > 0 ? (
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                  {job.approved_images.length} approved — publish to:
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                  Click images above to approve them, then publish
                                </span>
                              )}

                              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                {job.published_to?.etsy ? (
                                  <a
                                    href={job.published_to.etsy.url ?? "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                      padding: "7px 12px",
                                      borderRadius: 7,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: "rgba(249,115,22,0.1)",
                                      border: "1px solid rgba(249,115,22,0.25)",
                                      color: "#f97316",
                                      textDecoration: "none",
                                    }}
                                  >
                                    <ExternalLink size={11} /> View Etsy Draft
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => publish(job.id, "etsy")}
                                    disabled={!job.approved_images?.length || publishing === `${job.id}-etsy`}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                      padding: "7px 12px",
                                      borderRadius: 7,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: "rgba(249,115,22,0.1)",
                                      border: "1px solid rgba(249,115,22,0.25)",
                                      color: "#f97316",
                                      cursor: job.approved_images?.length ? "pointer" : "not-allowed",
                                      opacity: job.approved_images?.length ? 1 : 0.5,
                                    }}
                                  >
                                    {publishing === `${job.id}-etsy` ? (
                                      <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                                    ) : (
                                      <ShoppingBag size={11} />
                                    )}
                                    Publish to Etsy
                                  </button>
                                )}

                                {job.published_to?.gumroad ? (
                                  <a
                                    href={job.published_to.gumroad.url ?? "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                      padding: "7px 12px",
                                      borderRadius: 7,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: "rgba(255,144,232,0.1)",
                                      border: "1px solid rgba(255,144,232,0.25)",
                                      color: "#ff90e8",
                                      textDecoration: "none",
                                    }}
                                  >
                                    <ExternalLink size={11} /> View Gumroad
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => publish(job.id, "gumroad")}
                                    disabled={!job.approved_images?.length || publishing === `${job.id}-gumroad`}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                      padding: "7px 12px",
                                      borderRadius: 7,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: "rgba(255,144,232,0.1)",
                                      border: "1px solid rgba(255,144,232,0.25)",
                                      color: "#ff90e8",
                                      cursor: job.approved_images?.length ? "pointer" : "not-allowed",
                                      opacity: job.approved_images?.length ? 1 : 0.5,
                                    }}
                                  >
                                    {publishing === `${job.id}-gumroad` ? (
                                      <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                                    ) : (
                                      <Package size={11} />
                                    )}
                                    Publish to Gumroad
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
