import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { repoUrl } = await req.json();
    if (!repoUrl) return NextResponse.json({ error: "No repo URL provided" }, { status: 400 });

    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });

    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "github")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "GitHub integration not configured" }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${setting.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "builder-os",
    };

    const { owner, repo } = parsed;
    const base = `https://api.github.com/repos/${owner}/${repo}`;

    const [repoRes, commitsRes] = await Promise.all([
      fetch(base, { headers }),
      fetch(`${base}/commits?per_page=5`, { headers }),
    ]);

    if (!repoRes.ok) {
      const err = await repoRes.json();
      return NextResponse.json({ error: err.message ?? "GitHub API error" }, { status: repoRes.status });
    }

    const repoData = await repoRes.json();
    const commitsData = commitsRes.ok ? await commitsRes.json() : [];
    const lastCommit = commitsData[0] ?? null;

    return NextResponse.json({
      name: repoData.name,
      full_name: repoData.full_name,
      description: repoData.description,
      stars: repoData.stargazers_count,
      open_issues: repoData.open_issues_count,
      default_branch: repoData.default_branch,
      last_push: repoData.pushed_at,
      last_commit: lastCommit ? {
        sha: lastCommit.sha?.slice(0, 7),
        message: lastCommit.commit?.message?.split("\n")[0],
        author: lastCommit.commit?.author?.name,
        date: lastCommit.commit?.author?.date,
      } : null,
      recent_commits: commitsData.slice(0, 5).map((c: { sha: string; commit: { message: string; author: { name: string; date: string } } }) => ({
        sha: c.sha?.slice(0, 7),
        message: c.commit?.message?.split("\n")[0],
        author: c.commit?.author?.name,
        date: c.commit?.author?.date,
      })),
    });
  } catch (err) {
    console.error("GitHub integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
