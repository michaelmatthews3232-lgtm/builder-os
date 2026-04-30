import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EXPO_GQL = "https://api.expo.dev/graphql";

async function gql(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(EXPO_GQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export async function GET() {
  try {
    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "expo")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "Expo integration not configured" }, { status: 400 });
    }

    const token = setting.token as string;

    // Fetch account + recent builds via GraphQL
    const result = await gql(token, `
      query BuilderOSBuilds {
        me {
          username
          primaryEmail
          accounts {
            name
            builds(limit: 15, filter: {}) {
              edges {
                node {
                  id
                  status
                  platform
                  appVersion
                  buildProfile
                  createdAt
                  completedAt
                  app {
                    name
                    slug
                  }
                  error {
                    errorCode
                    title
                  }
                }
              }
            }
          }
        }
      }
    `);

    if (result.errors) {
      const msg = result.errors[0]?.message ?? "Expo GraphQL error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const me = result.data?.me;
    if (!me) {
      return NextResponse.json({ error: "Could not fetch Expo account info" }, { status: 400 });
    }

    const username = me.username ?? me.primaryEmail ?? "unknown";
    const accounts = me.accounts ?? [];

    // Flatten builds across all accounts
    const allBuilds: {
      id: string;
      status: string;
      platform: string;
      app_version?: string;
      build_profile?: string;
      created_at: string;
      completed_at?: string;
      project_name: string;
      error_message?: string;
    }[] = [];

    for (const account of accounts) {
      const edges = account.builds?.edges ?? [];
      for (const { node: b } of edges) {
        allBuilds.push({
          id: b.id,
          status: b.status,
          platform: b.platform,
          app_version: b.appVersion,
          build_profile: b.buildProfile,
          created_at: b.createdAt,
          completed_at: b.completedAt ?? undefined,
          project_name: b.app?.name ?? b.app?.slug ?? "Unknown",
          error_message: b.error?.title ?? undefined,
        });
      }
    }

    // Sort by newest first
    allBuilds.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const activeBuilds = allBuilds.filter(
      (b) => b.status === "IN_QUEUE" || b.status === "IN_PROGRESS"
    ).length;

    return NextResponse.json({
      account: username,
      recent_builds: allBuilds.slice(0, 10),
      active_builds: activeBuilds,
    });
  } catch (err) {
    console.error("Expo integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
