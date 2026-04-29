"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewIdeaModal } from "@/components/NewIdeaModal";
import type { Idea, IdeaStatus } from "@/lib/types";
import {
  Plus,
  Lightbulb,
  Rocket,
  Archive,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";

export default function IdeasPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | "all">("all");
  const [converting, setConverting] = useState<string | null>(null);

  const fetchIdeas = async () => {
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .order("created_at", { ascending: false });
    setIdeas((data as Idea[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchIdeas(); }, []);

  const deleteIdea = async (id: string) => {
    await supabase.from("ideas").delete().eq("id", id);
    fetchIdeas();
  };

  const archiveIdea = async (id: string) => {
    await supabase.from("ideas").update({ status: "archived" }).eq("id", id);
    fetchIdeas();
  };

  const validateIdea = async (id: string) => {
    await supabase.from("ideas").update({ status: "validated" }).eq("id", id);
    fetchIdeas();
  };

  const convertToProject = async (idea: Idea) => {
    setConverting(idea.id);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: idea.title,
        description: idea.description,
        status: "planned",
        revenue_monthly: 0,
        external_links: {
          stripe_dashboard_url: "",
          github_repo_url: "",
          firebase_url: "",
          revenuecat_url: "",
          deployment_url: "",
          other_tools: [],
        },
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("ideas").update({ status: "archived" }).eq("id", idea.id);
      router.push(`/projects/${data.id}`);
    }
    setConverting(null);
  };

  const filtered =
    filterStatus === "all"
      ? ideas
      : ideas.filter((i) => i.status === filterStatus);

  const grouped = {
    validated: filtered.filter((i) => i.status === "validated"),
    idea: filtered.filter((i) => i.status === "idea"),
    archived: filtered.filter((i) => i.status === "archived"),
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Idea Vault
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {ideas.filter((i) => i.status !== "archived").length} active ideas ·{" "}
            {ideas.filter((i) => i.status === "validated").length} validated
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
          Capture Idea
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["all", "validated", "idea", "archived"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "5px 14px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: filterStatus === s ? "var(--border-accent)" : "var(--border)",
              background: filterStatus === s ? "var(--accent-dim)" : "transparent",
              color: filterStatus === s ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.12s",
            }}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : ideas.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Lightbulb size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Your vault is empty. Capture your first idea.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Capture Idea
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Validated */}
          {(filterStatus === "all" || filterStatus === "validated") && grouped.validated.length > 0 && (
            <IdeaGroup
              title="Validated"
              icon={<Rocket size={14} />}
              ideas={grouped.validated}
              color="#34d399"
              onDelete={deleteIdea}
              onArchive={archiveIdea}
              onValidate={validateIdea}
              onConvert={convertToProject}
              converting={converting}
            />
          )}

          {/* Ideas */}
          {(filterStatus === "all" || filterStatus === "idea") && grouped.idea.length > 0 && (
            <IdeaGroup
              title="Ideas"
              icon={<Lightbulb size={14} />}
              ideas={grouped.idea}
              color="#fbbf24"
              onDelete={deleteIdea}
              onArchive={archiveIdea}
              onValidate={validateIdea}
              onConvert={convertToProject}
              converting={converting}
            />
          )}

          {/* Archived */}
          {(filterStatus === "all" || filterStatus === "archived") && grouped.archived.length > 0 && (
            <IdeaGroup
              title="Archived"
              icon={<Archive size={14} />}
              ideas={grouped.archived}
              color="#4b5563"
              onDelete={deleteIdea}
              onArchive={archiveIdea}
              onValidate={validateIdea}
              onConvert={convertToProject}
              converting={converting}
            />
          )}
        </div>
      )}

      {showModal && (
        <NewIdeaModal onClose={() => setShowModal(false)} onCreated={fetchIdeas} />
      )}
    </div>
  );
}

function IdeaGroup({
  title,
  icon,
  ideas,
  color,
  onDelete,
  onArchive,
  onValidate,
  onConvert,
  converting,
}: {
  title: string;
  icon: React.ReactNode;
  ideas: Idea[];
  color: string;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onValidate: (id: string) => void;
  onConvert: (idea: Idea) => void;
  converting: string | null;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color }}>{icon}</span>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </h2>
        <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {ideas.length}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="card card-hover"
            style={{ padding: 18, display: "flex", flexDirection: "column", gap: 0 }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                {idea.title}
              </h3>
              <StatusBadge type="idea" value={idea.status} />
            </div>

            {idea.description && (
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14, flex: 1 }}>
                {idea.description}
              </p>
            )}

            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 12,
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                {format(new Date(idea.created_at), "MMM d, yyyy")}
              </span>
              <div className="flex items-center gap-1.5">
                {idea.status === "idea" && (
                  <button
                    onClick={() => onValidate(idea.id)}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 5,
                      background: "rgba(52,211,153,0.08)",
                      color: "#34d399",
                      border: "1px solid rgba(52,211,153,0.2)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontFamily: "'Sora', sans-serif",
                    }}
                  >
                    Validate
                  </button>
                )}
                {idea.status !== "archived" && (
                  <button
                    onClick={() => onConvert(idea)}
                    disabled={converting === idea.id}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 5,
                      background: converting === idea.id ? "rgba(0,212,160,0.05)" : "var(--accent-dim)",
                      color: "var(--accent)",
                      border: "1px solid var(--border-accent)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontFamily: "'Sora', sans-serif",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <ArrowUpRight size={10} />
                    {converting === idea.id ? "..." : "→ Project"}
                  </button>
                )}
                {idea.status !== "archived" && (
                  <button
                    onClick={() => onArchive(idea.id)}
                    style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", opacity: 0.6, padding: 3 }}
                  >
                    <Archive size={12} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(idea.id)}
                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 3 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
