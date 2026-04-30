import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    const headers = {
      Authorization: `Bearer ${setting.token}`,
      "Content-Type": "application/json",
    };

    // Fetch account info
    const meRes = await fetch("https://api.expo.dev/v2/auth/userInfo", { headers });
    if (!meRes.ok) {
      const err = await meRes.json();
      return NextResponse.json({ error: err.errors?.[0]?.message ?? "Expo API error" }, { status: meRes.status });
    }
    const meData = await meRes.json();
    const username = meData.data?.username ?? meData.data?.primaryEmail ?? "unknown";

    // Fetch apps
    const appsRes = await fetch(`https://api.expo.dev/v2/projects?limit=20`, { headers });
    const appsData = appsRes.ok ? await appsRes.json() : null;
    const apps = appsData?.data ?? [];

    // Fetch recent builds across all apps
    const buildsRes = await fetch(
      `https://api.expo.dev/v2/builds?limit=10&status=in-queue,in-progress,finished,errored`,
      { headers }
    );
    const buildsData = buildsRes.ok ? await buildsRes.json() : null;
    const builds = buildsData?.data ?? [];

    const activeBuilds = builds.filter((b: { status: string }) =>
      b.status === "in-queue" || b.status === "in-progress"
    );

    return NextResponse.json({
      account: username,
      apps: apps.map((a: { id: string; name: string; slug: string; platform: string }) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        platform: a.platform,
      })),
      recent_builds: builds.slice(0, 10).map((b: {
        id: string;
        status: string;
        platform: string;
        appVersion?: string;
        buildProfile?: string;
        createdAt: string;
        completedAt?: string;
        project?: { name: string; slug: string };
        error?: { message: string };
      }) => ({
        id: b.id,
        status: b.status,
        platform: b.platform,
        app_version: b.appVersion,
        build_profile: b.buildProfile,
        created_at: b.createdAt,
        completed_at: b.completedAt,
        project_name: b.project?.name ?? b.project?.slug ?? "Unknown",
        error_message: b.error?.message,
      })),
      active_builds: activeBuilds.length,
    });
  } catch (err) {
    console.error("Expo integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
