import type { ProjectStatus, TaskStatus, TaskPriority, IdeaStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  idea: {
    label: "Idea",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.12)",
    dot: "#6b7280",
  },
  planned: {
    label: "Planned",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    dot: "#60a5fa",
  },
  building: {
    label: "Building",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.12)",
    dot: "#fbbf24",
  },
  monetizing: {
    label: "Monetizing",
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    dot: "#34d399",
  },
  scaling: {
    label: "Scaling",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    dot: "#a78bfa",
  },
  archived: {
    label: "Archived",
    color: "#374151",
    bg: "rgba(55,65,81,0.12)",
    dot: "#374151",
  },
};

const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bg: string }
> = {
  todo: { label: "To Do", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  in_progress: { label: "In Progress", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  done: { label: "Done", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
};

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bg: string }
> = {
  high: { label: "High", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  medium: { label: "Med", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  low: { label: "Low", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const IDEA_STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; color: string; bg: string }
> = {
  idea: { label: "Idea", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  validated: { label: "Validated", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  archived: { label: "Archived", color: "#374151", bg: "rgba(55,65,81,0.1)" },
};

interface Props {
  type: "project" | "task" | "priority" | "idea";
  value: string;
  showDot?: boolean;
}

export function StatusBadge({ type, value, showDot = false }: Props) {
  let cfg: { label: string; color: string; bg: string; dot?: string } | undefined;

  if (type === "project") cfg = STATUS_CONFIG[value as ProjectStatus];
  else if (type === "task") cfg = TASK_STATUS_CONFIG[value as TaskStatus];
  else if (type === "priority") cfg = PRIORITY_CONFIG[value as TaskPriority];
  else if (type === "idea") cfg = IDEA_STATUS_CONFIG[value as IdeaStatus];

  if (!cfg) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        color: cfg.color,
        background: cfg.bg,
        fontFamily: "'Sora', sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {(showDot || type === "project") && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: cfg.dot ?? cfg.color,
            flexShrink: 0,
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}
