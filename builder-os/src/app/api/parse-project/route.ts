import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PRIORITY_FILES = new Set([
  "readme.md", "readme.txt", "readme",
  "package.json", "app.json", "pubspec.yaml",
  ".env.example", ".env.local.example",
]);

export async function POST(req: NextRequest) {
  try {
    const { files } = await req.json() as { files: Array<{ name: string; content: string }> };

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Priority files first
    const sorted = [...files].sort((a, b) => {
      const aP = PRIORITY_FILES.has(a.name.toLowerCase()) ? 0 : 1;
      const bP = PRIORITY_FILES.has(b.name.toLowerCase()) ? 0 : 1;
      return aP - bP;
    });

    // Build content string capped at 8000 chars
    let combinedContent = "";
    for (const f of sorted) {
      const chunk = `### ${f.name}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\`\n\n`;
      if (combinedContent.length + chunk.length > 8000) break;
      combinedContent += chunk;
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Extract project metadata from these files. Return ONLY a JSON object with these exact fields:

{
  "name": "project name",
  "description": "2-3 sentence description of what this project does",
  "category": "one of: SaaS, Mobile App, Website, Tool, Agency, E-commerce, Other",
  "status": "one of: idea, planned, building, monetizing, scaling, archived",
  "revenue_monthly": 0,
  "deployment_url": "",
  "github_repo_url": "",
  "firebase_url": "",
  "stripe_dashboard_url": "",
  "revenuecat_url": ""
}

Rules:
- name: the actual project name, not the folder name if different
- status: infer from files — deployed URL present = building, just docs = planned, revenue mentioned = monetizing
- revenue_monthly: number only, 0 if unknown
- URLs: only include if explicitly found in the files, otherwise empty string
- Return ONLY valid JSON, no explanation

Files:
${combinedContent}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract project data" }, { status: 400 });
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err) {
    console.error("parse-project error:", err);
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
