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
    const { siteUrl, projectName } = await req.json();

    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "netlify")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "Netlify integration not configured" }, { status: 400 });
    }

    const headers = { Authorization: `Bearer ${setting.token}` };

    const sitesRes = await fetch("https://api.netlify.com/api/v1/sites?per_page=100", { headers });
    if (!sitesRes.ok) {
      return NextResponse.json({ error: "Netlify API error" }, { status: sitesRes.status });
    }

    const sites = await sitesRes.json();
    const domain = siteUrl ? extractDomain(siteUrl) : null;

    const match = sites?.find((s: { ssl_url?: string; url?: string; name: string; custom_domain?: string }) => {
      if (domain) {
        const siteDomain = extractDomain(s.ssl_url ?? s.url ?? "");
        if (siteDomain.includes(domain) || domain.includes(siteDomain)) return true;
        if (s.custom_domain && (s.custom_domain.includes(domain) || domain.includes(s.custom_domain))) return true;
      }
      if (projectName && s.name.toLowerCase().includes(projectName.toLowerCase().replace(/\s+/g, "-"))) return true;
      return false;
    }) ?? sites?.[0];

    if (!match) {
      return NextResponse.json({
        sites: sites?.map((s: { id: string; name: string; url: string }) => ({ id: s.id, name: s.name, url: s.url })) ?? [],
        matched: null,
      });
    }

    // Get recent deploys
    const deploysRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${match.id}/deploys?per_page=5`,
      { headers }
    );
    const deploys = deploysRes.ok ? await deploysRes.json() : [];
    const latest = deploys[0] ?? null;

    return NextResponse.json({
      matched: {
        id: match.id,
        name: match.name,
        url: match.ssl_url ?? match.url,
        custom_domain: match.custom_domain,
        state: match.state,
        published_deploy: match.published_deploy ? {
          state: match.published_deploy.state,
          created_at: match.published_deploy.created_at,
          deploy_time: match.published_deploy.deploy_time,
        } : null,
        latest_deploy: latest ? {
          id: latest.id,
          state: latest.state,
          branch: latest.branch,
          title: latest.title,
          created_at: latest.created_at,
          deploy_time: latest.deploy_time,
          error_message: latest.error_message,
        } : null,
        recent_deploys: deploys.slice(0, 5).map((d: { id: string; state: string; branch: string; title: string; created_at: string; deploy_time: number }) => ({
          id: d.id,
          state: d.state,
          branch: d.branch,
          title: d.title,
          created_at: d.created_at,
          deploy_time: d.deploy_time,
        })),
      },
    });
  } catch (err) {
    console.error("Netlify integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
