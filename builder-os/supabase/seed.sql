-- ════════════════════════════════════════════════════════════
-- BUILDER OS — SEED DATA
-- Run AFTER schema.sql in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- ─── PROJECTS ────────────────────────────────────────────────
insert into projects (id, name, description, category, status, revenue_monthly, external_links)
values

  -- 1. CashLens
  (
    '11111111-0000-0000-0000-000000000001',
    'CashLens',
    'Transaction analysis tool for freelancers and small businesses. Provides anomaly detection, subscription tracking, and cashflow insights to eliminate financial blind spots.',
    'Financial Intelligence SaaS',
    'planned',
    0,
    '{
      "stripe_dashboard_url": "",
      "github_repo_url": "",
      "firebase_url": "",
      "revenuecat_url": "",
      "deployment_url": "",
      "other_tools": [
        {"name": "Plaid API Docs", "url": "https://plaid.com/docs/"},
        {"name": "OpenAI API", "url": "https://platform.openai.com"}
      ]
    }'::jsonb
  ),

  -- 2. ScamShield
  (
    '11111111-0000-0000-0000-000000000002',
    'ScamShield',
    'AI system that analyzes emails and messages to detect scams, phishing, impersonation, and social engineering attempts. Targets seniors and high-risk populations.',
    'AI Security Tool',
    'idea',
    0,
    '{
      "stripe_dashboard_url": "",
      "github_repo_url": "",
      "firebase_url": "",
      "revenuecat_url": "",
      "deployment_url": "",
      "other_tools": []
    }'::jsonb
  ),

  -- 3. Body Compass
  (
    '11111111-0000-0000-0000-000000000003',
    'Body Compass',
    'Personal body awareness system tracking energy levels, habits, and physiological signals. Live on Android; iOS in development. Integrates HealthKit, Health Connect, and barcode scanning.',
    'Health / Personal Analytics',
    'building',
    0,
    '{
      "stripe_dashboard_url": "",
      "github_repo_url": "",
      "firebase_url": "",
      "revenuecat_url": "",
      "deployment_url": "https://play.google.com/store",
      "other_tools": [
        {"name": "Expo Dashboard", "url": "https://expo.dev"},
        {"name": "Firebase Console", "url": "https://console.firebase.google.com"},
        {"name": "RevenueCat", "url": "https://app.revenuecat.com"},
        {"name": "App Store Connect", "url": "https://appstoreconnect.apple.com"}
      ]
    }'::jsonb
  ),

  -- 4. Noctly
  (
    '11111111-0000-0000-0000-000000000004',
    'Noctly',
    'Late-night anonymous voice connection app. Two-dots-with-pulse icon on dark background. React Native / Expo with Firebase backend. App name and icon finalized; scaffold complete.',
    'Social / Voice App',
    'building',
    0,
    '{
      "stripe_dashboard_url": "",
      "github_repo_url": "",
      "firebase_url": "",
      "revenuecat_url": "",
      "deployment_url": "",
      "other_tools": [
        {"name": "Expo Dashboard", "url": "https://expo.dev"},
        {"name": "Firebase Console", "url": "https://console.firebase.google.com"}
      ]
    }'::jsonb
  ),

  -- 5. Candor
  (
    '11111111-0000-0000-0000-000000000005',
    'Candor',
    'Dating platform that requires users to provide structured feedback on swipes to improve match transparency and reduce ghosting. Feedback-first mechanic differentiates from swipe apps.',
    'Social / Dating Feedback System',
    'idea',
    0,
    '{
      "stripe_dashboard_url": "",
      "github_repo_url": "",
      "firebase_url": "",
      "revenuecat_url": "",
      "deployment_url": "",
      "other_tools": []
    }'::jsonb
  ),

  -- 6. Utility Haven (bonus — live project)
  (
    '11111111-0000-0000-0000-000000000006',
    'Utility Haven',
    'Suite of 22+ browser-based utility tools covering writing, legal, marketing, and productivity. Live at utilityhaven.netlify.app. Includes NDA Clause Builder, Ad Copy Generator, and more.',
    'Utility SaaS / Free Tools',
    'monetizing',
    0,
    '{
      "stripe_dashboard_url": "",
      "github_repo_url": "",
      "firebase_url": "",
      "revenuecat_url": "",
      "deployment_url": "https://utilityhaven.netlify.app",
      "other_tools": [
        {"name": "Netlify Dashboard", "url": "https://app.netlify.com"}
      ]
    }'::jsonb
  )

on conflict (id) do nothing;

-- ─── SAMPLE TASKS ────────────────────────────────────────────
insert into tasks (project_id, title, description, status, priority, assigned_to, due_date)
values

  -- Body Compass tasks
  (
    '11111111-0000-0000-0000-000000000003',
    'iOS freelancer device testing & App Store submission',
    'Coordinate Upwork hire for iOS device testing. Share .p12 cert via existing co-developer workaround.',
    'todo', 'high', 'contractor', (current_date + interval '7 days')::date
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'Finalize new landing page with barcode scanning feature',
    'Incorporate barcode scanning and HealthKit/Health Connect features into landing page copy and visuals.',
    'in_progress', 'high', 'self', (current_date + interval '3 days')::date
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'Create batch of 5 Instagram marketing posts',
    'Focus on the body signal tracking angle. Dark aesthetic matching app branding.',
    'todo', 'medium', 'self', (current_date + interval '5 days')::date
  ),

  -- Noctly tasks
  (
    '11111111-0000-0000-0000-000000000004',
    'Resolve remaining Firebase config errors in RN build',
    'Debug Firebase initialization conflicts in Expo managed workflow. Check google-services.json placement.',
    'in_progress', 'high', 'self', (current_date + interval '2 days')::date
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    'Design voice room UI screens',
    'Two-dot waveform animation for active voice sessions. Dark background, minimal UI.',
    'todo', 'medium', 'self', (current_date + interval '10 days')::date
  ),

  -- CashLens tasks
  (
    '11111111-0000-0000-0000-000000000001',
    'Validate ICP: interview 5 freelancers about cashflow pain',
    'Target 1099 contractors and small agency owners. Focus on subscription blindspot and anomaly detection needs.',
    'todo', 'high', 'self', (current_date + interval '14 days')::date
  ),
  (
    '11111111-0000-0000-0000-000000000001',
    'Map out Plaid API integration requirements',
    'Review transaction data schema, rate limits, and consent flows. Estimate dev lift for MVP.',
    'todo', 'medium', 'self', null
  ),

  -- Utility Haven tasks
  (
    '11111111-0000-0000-0000-000000000006',
    'Add SEO meta tags to all 22 tools',
    'Each tool page needs unique title, description, and og:tags for better search indexing.',
    'todo', 'medium', 'self', (current_date + interval '7 days')::date
  ),
  (
    '11111111-0000-0000-0000-000000000006',
    'Build monetization strategy doc',
    'Evaluate: ads, Gumroad toolkit, freemium API access, Pro tier. Pick one and test.',
    'todo', 'high', 'self', (current_date + interval '4 days')::date
  )

on conflict do nothing;

-- ─── SAMPLE IDEAS ────────────────────────────────────────────
insert into ideas (title, description, status)
values
  (
    'FedEx Route Tracker',
    'Internal dashboard for tracking linehaul route performance, maintenance costs, and profitability per route. Potential SaaS for other FedEx ISP operators.',
    'idea'
  ),
  (
    'Founder''s Daily Brief',
    'AI-generated morning briefing that pulls in your key metrics across all SaaS tools (Stripe, RevenueCat, analytics) and delivers a 60-second voice or text summary.',
    'validated'
  ),
  (
    'AML Pattern Library',
    'Reference tool for fraud/AML analysts documenting typologies, red flags, and case patterns. Monetize via B2B subscription to compliance teams.',
    'idea'
  ),
  (
    'CoJourney',
    'Solo traveler companion-matching app. React Native/Expo with Supabase backend. Weighted matching algorithm, real-time chat, trip posting system.',
    'validated'
  )

on conflict do nothing;
