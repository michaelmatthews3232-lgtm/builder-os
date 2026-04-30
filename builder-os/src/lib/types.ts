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

export type ProjectEntity = "llc" | "personal" | "unknown";

export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  status: ProjectStatus;
  entity: ProjectEntity;
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

export type BlockedReason = "money" | "ai_limits" | "time" | "dependency" | "waiting" | "other";

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string;
  due_date: string | null;
  is_blocked: boolean;
  blocked_reason: BlockedReason | null;
  unblock_cost: number | null;
  blocked_notes: string | null;
  created_at: string;
  // Joined
  project?: Pick<Project, "id" | "name" | "status">;
}

export const BLOCKER_REASON_CONFIG: Record<BlockedReason, { label: string; color: string }> = {
  money:       { label: "Need Money",         color: "#34d399" },
  ai_limits:   { label: "AI / API Limits",    color: "#a78bfa" },
  time:        { label: "Need More Time",      color: "#60a5fa" },
  dependency:  { label: "Waiting on Dep",     color: "#fbbf24" },
  waiting:     { label: "Waiting on Someone", color: "#fb923c" },
  other:       { label: "Other",              color: "#6b7280" },
};

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
  platform: string | null;
  hourly_rate: number | null;
  email: string | null;
  created_at: string;
}

export interface ContractorUpdate {
  id: string;
  contractor_id: string;
  project_id: string;
  note: string;
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
  notes: string | null;
  created_at: string;
}

export type GoalType = "short_term" | "long_term";

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  created_at: string;
}

export type PlanItemStatus = "todo" | "done" | "outsourced";

export interface PlanItem {
  id: string;
  week_start: string;
  title: string;
  description: string | null;
  project_name: string | null;
  status: PlanItemStatus;
  outsource_to: string | null;
  priority: number;
  created_at: string;
}

export interface LLCProfile {
  id: string;
  name: string;
  ein: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  hosting_provider: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SalesLeadStatus = "lead" | "contacted" | "responded" | "converted" | "lost";

export interface SalesLead {
  id: string;
  project_id: string;
  contact_name: string | null;
  contact_info: string | null;
  status: SalesLeadStatus;
  notes: string | null;
  milestone_goal: string | null;
  source: string | null;
  created_at: string;
}

export interface FinanceSnapshot {
  id: string;
  month: string;
  revenue: number;
  expenses: number;
  net: number;
  notes: string | null;
  created_at: string;
}

export type ExpenseCategory = "hosting" | "ai_tools" | "subscriptions" | "domain" | "contractor" | "other";
export type BillingCycle = "monthly" | "annual" | "one_time";

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  billing_cycle: BillingCycle;
  project_id: string | null;
  notes: string | null;
  active: boolean;
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
