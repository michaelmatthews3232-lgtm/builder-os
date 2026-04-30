import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { deploymentUrl, projectName } = await req.json();

    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "vercel")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "Vercel integration not configured" }, { status: 400 });
    }

    const headers = { Authorization: `Bearer ${setting.token}` };

    // List all Vercel projects and find a match
    const projectsRes = await fetch("https://api.vercel.com/v9/projects?limit=100", { headers });
    if (!projectsRes.ok) {
      const err = await projectsRes.json();
      return NextResponse.json({ error: err.error?.message ?? "Vercel API error" }, { status: projectsRes.status });
    }

    const { projects } = await projectsRes.json();
    const domain = deploymentUrl ? extractDomain(deploymentUrl) : null;

    // Match by domain alias or project name
    const match = projects?.find((p: { alias?: { domain: string }[]; name: string }) => {
      if (domain && p.alias?.some((a: { domain: string }) => a.domain.includes(domain) || domain.includes(a.domain))) return true;
      if (projectName && p.name.toLowerCase().includes(projectName.toLowerCase().replace(/\s+/g, "-"))) return true;
      return false;
    }) ?? projects?.[0];

    if (!match) {
      return NextResponse.json({ projects: projects?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) ?? [], matched: null });
    }

    // Get latest deployments for the matched project
    const deploysRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${match.id}&limit=5`,
      { headers }
    );
    const deploysData = deploysRes.ok ? await deploysRes.json() : { deployments: [] };
    const latest = deploysData.deployments?.[0] ?? null;

    return NextResponse.json({
      matched: {
        id: match.id,
        name: match.name,
        framework: match.framework,
        latest_deployment: latest ? {
          uid: latest.uid,
          state: latest.state,
          url: `https://${latest.url}`,
          created: latest.createdAt,
          source: latest.meta?.githubCommitMessage?.split("\n")[0] ?? null,
        } : null,
        recent_deployments: deploysData.deployments?.slice(0, 5).map((d: { uid: string; state: string; url: string; createdAt: number; meta?: { githubCommitMessage?: string } }) => ({
          uid: d.uid,
          state: d.state,
          url: `https://${d.url}`,
          created: d.createdAt,
          message: d.meta?.githubCommitMessage?.split("\n")[0] ?? null,
        })) ?? [],
      },
    });
  } catch (err) {
    console.error("Vercel integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
