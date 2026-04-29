-- ════════════════════════════════════════════════════════════
-- BUILDER OS — SUPABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── PROJECTS ────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,
  name        text not null,
  description text,
  category    text,
  status      text not null default 'idea'
                check (status in ('idea','planned','building','monetizing','scaling','archived')),
  revenue_monthly numeric(12,2) not null default 0,
  external_links  jsonb not null default '{
    "stripe_dashboard_url": "",
    "github_repo_url": "",
    "firebase_url": "",
    "revenuecat_url": "",
    "deployment_url": "",
    "other_tools": []
  }'::jsonb,
  -- Future extension hooks
  external_event_sources jsonb default '[]'::jsonb,
  integration_hooks      jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── TASKS ───────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade not null,
  title       text not null,
  description text,
  status      text not null default 'todo'
                check (status in ('todo','in_progress','done')),
  priority    text not null default 'medium'
                check (priority in ('low','medium','high')),
  assigned_to text not null default 'self',
  due_date    date,
  created_at  timestamptz not null default now()
);

-- ─── IDEAS ───────────────────────────────────────────────────
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'idea'
                check (status in ('idea','validated','archived')),
  created_at  timestamptz not null default now()
);

-- ─── CONTRACTORS ─────────────────────────────────────────────
create table if not exists contractors (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade not null,
  name        text not null,
  role        text,
  status      text not null default 'active'
                check (status in ('active','inactive','completed')),
  created_at  timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
-- Disabled for personal use. Enable when adding multi-user auth.
-- alter table projects enable row level security;
-- alter table tasks enable row level security;
-- alter table ideas enable row level security;
-- alter table contractors enable row level security;
