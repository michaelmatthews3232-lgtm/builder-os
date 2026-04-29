# Builder OS — Founder Control Portal

A personal operating system for managing multiple SaaS businesses and projects. Multi-project execution dashboard built with Next.js 14, Supabase, and Tailwind CSS.

---

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase (scaffold included, optional for personal use)
- **Hosting**: Vercel-compatible

---

## Setup (5 minutes)

### 1. Clone and install

```bash
git clone <your-repo>
cd builder-os
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for provisioning (~1 min)
3. Go to **Project Settings → API**
4. Copy your **Project URL** and **anon public** key

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the schema

In Supabase Dashboard → **SQL Editor** → **New Query**:

1. Paste and run `/supabase/schema.sql` — creates all tables
2. Paste and run `/supabase/seed.sql` — loads all preloaded projects + tasks + ideas

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Your projects will be live.

---

## Preloaded Projects

The seed file loads these projects immediately:

| Project | Category | Status |
|---------|----------|--------|
| CashLens | Financial Intelligence SaaS | Planned |
| ScamShield | AI Security Tool | Idea |
| Body Compass | Health / Analytics | Building |
| Noctly | Social / Voice App | Building |
| Candor | Dating Feedback System | Idea |
| Utility Haven | Utility SaaS | Monetizing |

Plus 9 pre-seeded tasks across Body Compass, Noctly, CashLens, and Utility Haven.

---

## Features

### Dashboard `/`
- Revenue summary, active project count, open tasks, due today
- Sorted focus queue (top 5 priority tasks)
- Pipeline visualization (status distribution bar chart)

### Projects `/projects`
- Grid view with status filters and search
- Per-project: status, revenue, category, description, LIVE/GH badges

### Project Detail `/projects/[id]`
- Edit project status and revenue inline
- **Tasks tab**: full task list with status management
- **Links tab**: Stripe, GitHub, Firebase, RevenueCat, Deployment — editable
- **Contractors tab**: lightweight contractor tracking

### Tasks `/tasks`
- **Board view**: Kanban columns (To Do / In Progress / Done)
- **List view**: flat sortable list
- Filter by project
- Mark complete, delete, change status inline

### Ideas Vault `/ideas`
- Grouped by status: Validated → Ideas → Archived
- One-click **→ Project** conversion (creates project, archives idea)
- Validate and archive actions

### Today `/today`
- Smart-sorted execution queue across ALL projects
- Sort order: Overdue → Due Today → by Project Status weight → Priority → No date
- Check-off interface for rapid execution

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Data Model

```
projects
  id, name, description, category, status, revenue_monthly
  external_links (jsonb): stripe, github, firebase, revenuecat, deployment, other_tools[]
  external_event_sources, integration_hooks  ← future extension hooks

tasks
  id, project_id, title, description, status, priority, assigned_to, due_date

ideas
  id, title, description, status

contractors
  id, project_id, name, role, status
```

---

## Future Extensions (scaffolded, not built)

The schema includes `external_event_sources` (jsonb array) and `integration_hooks` (jsonb object) on every project row — ready for:

- GitHub commit tracking
- App Store / Play Store metrics
- CRM / lead tracking
- AI prioritization engine

---

## Security Note

Row Level Security (RLS) is commented out in the schema for personal single-user use. To enable multi-user auth:
1. Uncomment the RLS lines in `schema.sql`
2. Add RLS policies for `auth.uid() = user_id`
3. Implement login flow with Supabase Auth
