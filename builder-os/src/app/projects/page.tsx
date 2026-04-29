"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { NewProjectModal } from "@/components/NewProjectModal";
import type { Project, ProjectStatus } from "@/lib/types";
import { Plus, ArrowRight, Search, DollarSign } from "lucide-react";
import { FolderDropZone, type ParsedProject } from "@/components/FolderDropZone";
import { ProjectImportModal } from "@/components/ProjectImportModal";

const STATUS_ORDER: ProjectStatus[] = [
  "monetizing",
  "scaling",
  "building",
  "planned",
  "idea",
  "archived",
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all");
  const [importData, setImportData] = useState<ParsedProject | null>(null);
  const [importFileCount, setImportFileCount] = useState(0);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const filtered = projects
    .filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );

  const totalRevenue = projects.reduce((s, p) => s + p.revenue_monthly, 0);

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Projects
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {projects.filter((p) => p.status !== "archived").length} active ·{" "}
            {projects.length} total
            {totalRevenue > 0 && (
              <span style={{ color: "#34d399", marginLeft: 8, fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                · ${totalRevenue.toLocaleString()}/mo
              </span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
          New Project
        </button>
      </div>

      {/* Folder Import */}
      <FolderDropZone
        onParsed={(data, count) => {
          setImportData(data);
          setImportFileCount(count);
        }}
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            className="input-base"
            style={{ paddingLeft: 32 }}
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(["all", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s as typeof filterStatus)}
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                borderColor:
                  filterStatus === s ? "var(--border-accent)" : "var(--border)",
                background:
                  filterStatus === s ? "var(--accent-dim)" : "transparent",
                color:
                  filterStatus === s ? "var(--accent)" : "var(--text-muted)",
                transition: "all 0.12s",
              }}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}
        >
          <p style={{ marginBottom: 12 }}>No projects found.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Create your first project
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={fetchProjects}
        />
      )}

      {importData && (
        <ProjectImportModal
          initialData={importData}
          fileCount={importFileCount}
          onClose={() => setImportData(null)}
          onCreated={fetchProjects}
        />
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const hasDeployment = project.external_links?.deployment_url;
  const hasGitHub = project.external_links?.github_repo_url;

  return (
    <Link href={`/projects/${project.id}`} style={{ textDecoration: "none" }}>
      <div
        className="card card-hover"
        style={{ padding: 20, height: "100%", display: "flex", flexDirection: "column" }}
      >
        {/* Top */}
        <div className="flex items-start justify-between mb-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 mb-1.5">
              <StatusBadge type="project" value={project.status} />
            </div>
            <h3
              style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}
            >
              {project.name}
            </h3>
          </div>
          <ArrowRight size={15} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 4 }} />
        </div>

        {/* Category */}
        {project.category && (
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10 }}
          >
            {project.category}
          </span>
        )}

        {/* Description */}
        {project.description && (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              flex: 1,
              marginBottom: 14,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {project.description}
          </p>
        )}

        {/* Bottom */}
        <div
          className="flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: "auto" }}
        >
          <div className="flex items-center gap-2">
            {project.revenue_monthly > 0 ? (
              <span
                className="font-mono"
                style={{ fontSize: 13, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 3 }}
              >
                <DollarSign size={11} />
                {project.revenue_monthly.toLocaleString()}/mo
              </span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>$0 / mo</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasDeployment && (
              <span
                style={{
                  fontSize: 9,
                  color: "#34d399",
                  background: "rgba(52,211,153,0.1)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 600,
                  fontFamily: "JetBrains Mono, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                LIVE
              </span>
            )}
            {hasGitHub && (
              <span
                style={{
                  fontSize: 9,
                  color: "#60a5fa",
                  background: "rgba(96,165,250,0.1)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 600,
                  fontFamily: "JetBrains Mono, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                GH
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
