"use client";

import { useRef, useState, useCallback } from "react";
import { FolderOpen, Loader2, Upload } from "lucide-react";

// Files worth reading for project extraction
const USEFUL_FILE = /^(readme\.md|readme\.txt|readme|package\.json|app\.json|pubspec\.yaml|\.env\.example|\.env\.local\.example|[^/\\]+\.md)$/i;
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "build", "dist",
  "__pycache__", ".venv", "venv", "android", "ios", ".expo",
]);
const MAX_FILES = 12;

export interface ParsedProject {
  name: string;
  description: string;
  category: string;
  status: string;
  revenue_monthly: number;
  deployment_url: string;
  github_repo_url: string;
  firebase_url: string;
  stripe_dashboard_url: string;
  revenuecat_url: string;
}

interface Props {
  onParsed: (data: ParsedProject, fileCount: number) => void;
}

async function readFileEntry(
  entry: FileSystemFileEntry
): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => {
        const reader = new FileReader();
        reader.onload = (e) =>
          resolve({ name: entry.name, content: (e.target?.result as string) || "" });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      },
      () => resolve(null)
    );
  });
}

async function readDirEntry(
  entry: FileSystemDirectoryEntry,
  depth = 0
): Promise<Array<{ name: string; content: string }>> {
  if (depth > 2) return [];

  return new Promise((resolve) => {
    const results: Array<{ name: string; content: string }> = [];
    const reader = entry.createReader();

    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(results);
          return;
        }
        for (const e of entries) {
          if (results.length >= MAX_FILES) break;
          if (e.isDirectory) {
            if (!SKIP_DIRS.has(e.name)) {
              const sub = await readDirEntry(e as FileSystemDirectoryEntry, depth + 1);
              results.push(...sub.slice(0, MAX_FILES - results.length));
            }
          } else if (e.isFile && USEFUL_FILE.test(e.name)) {
            const file = await readFileEntry(e as FileSystemFileEntry);
            if (file) results.push(file);
          }
        }
        readBatch();
      });
    };

    readBatch();
  });
}

export function FolderDropZone({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "parsing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: Array<{ name: string; content: string }>) => {
      if (files.length === 0) {
        setStatus("error");
        setErrorMsg("No readable files found. Make sure the folder has a README or package.json.");
        return;
      }

      setStatus("parsing");
      try {
        const res = await fetch("/api/parse-project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        });

        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setStatus("idle");
        onParsed(data, files.length);
      } catch {
        setStatus("error");
        setErrorMsg("Extraction failed — make sure ANTHROPIC_API_KEY is set in .env.local.");
      }
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      setStatus("scanning");

      const files: Array<{ name: string; content: string }> = [];

      for (const item of Array.from(e.dataTransfer.items)) {
        const entry = item.webkitGetAsEntry();
        if (!entry) continue;

        if (entry.isDirectory) {
          const dirFiles = await readDirEntry(entry as FileSystemDirectoryEntry);
          files.push(...dirFiles);
        } else if (entry.isFile && USEFUL_FILE.test(entry.name)) {
          const file = await readFileEntry(entry as FileSystemFileEntry);
          if (file) files.push(file);
        }
      }

      await processFiles(files);
    },
    [processFiles]
  );

  const handleFolderInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputFiles = Array.from(e.target.files || []);
      setStatus("scanning");

      const useful = inputFiles.filter((f) => {
        const parts = f.webkitRelativePath.split("/");
        const hasSkipped = parts.slice(0, -1).some((p) => SKIP_DIRS.has(p));
        return !hasSkipped && USEFUL_FILE.test(f.name);
      });

      const readAll = await Promise.all(
        useful.slice(0, MAX_FILES).map(
          (f) =>
            new Promise<{ name: string; content: string } | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) =>
                resolve({ name: f.name, content: (ev.target?.result as string) || "" });
              reader.onerror = () => resolve(null);
              reader.readAsText(f);
            })
        )
      );

      await processFiles(
        readAll.filter(Boolean) as Array<{ name: string; content: string }>
      );

      if (inputRef.current) inputRef.current.value = "";
    },
    [processFiles]
  );

  const isLoading = status === "scanning" || status === "parsing";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? "var(--accent)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 10,
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        background: dragging ? "var(--accent-dim)" : "rgba(255,255,255,0.015)",
        transition: "all 0.15s",
      }}
    >
      {isLoading ? (
        <>
          <Loader2
            size={20}
            style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }}
          />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {status === "scanning" ? "Scanning files..." : "Extracting with AI..."}
          </span>
        </>
      ) : (
        <>
          <Upload size={18} style={{ color: "var(--text-muted)" }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 3 }}>
              Drop a project folder here
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Reads README, package.json &amp; docs — Claude fills in the details
            </p>
          </div>

          <button
            className="btn-ghost"
            onClick={() => inputRef.current?.click()}
            style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <FolderOpen size={13} />
            Select Folder
          </button>

          {status === "error" && (
            <p style={{ fontSize: 11, color: "#f87171", marginTop: 2, textAlign: "center" }}>
              {errorMsg}
            </p>
          )}
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFolderInput}
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        multiple
      />
    </div>
  );
}
