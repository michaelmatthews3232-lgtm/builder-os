export type ProjectStatus =
  | "idea"
  | "planned"
  | "building"
  | "monetizing"
  | "scaling"
  | "archived";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type IdeaStatus = "idea" | "validated" | "archived";
export type ContractorStatus = "active" | "inactive" | "completed";

export interface ExternalTool {
  name: string;
  url: string;
}

export interface ExternalLinks {
  stripe_dashboard_url: string;
  github_repo_url: string;
  firebase_url: string;
  revenuecat_url: string;
  deployment_url: string;
  other_tools: ExternalTool[];
}

export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  status: ProjectStatus;
  revenue_monthly: number;
  external_links: ExternalLinks;
  external_event_sources: unknown[];
  integration_hooks: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Derived / joined
  task_count?: number;
  open_task_count?: number;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string;
  due_date: string | null;
  created_at: string;
  // Joined
  project?: Pick<Project, "id" | "name" | "status">;
}

export interface Idea {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  status: IdeaStatus;
  created_at: string;
}

export interface Contractor {
  id: string;
  project_id: string;
  name: string;
  role: string | null;
  status: ContractorStatus;
  created_at: string;
}

// Status sort weight for TODAY view
export const PROJECT_STATUS_WEIGHT: Record<ProjectStatus, number> = {
  monetizing: 1,
  scaling: 2,
  building: 3,
  planned: 4,
  idea: 5,
  archived: 99,
};

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

export type KnowledgeCategory = "credential" | "api_key" | "url" | "payment" | "account" | "note";

export interface KnowledgeItem {
  id: string;
  project_id: string;
  label: string;
  value: string;
  category: KnowledgeCategory;
  created_at: string;
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: "Idea",
  planned: "Planned",
  building: "Building",
  monetizing: "Monetizing",
  scaling: "Scaling",
  archived: "Archived",
};
