import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { projectName, description, status } = await req.json();

  const prompt = `You are a marketing strategist for indie SaaS products. Generate a practical, actionable marketing plan for this project.

Project: ${projectName}
Status: ${status}
Description: ${description || "No description provided"}

Return a JSON object with these keys:
- positioning: string (1-2 sentence value prop / positioning statement)
- target_audience: string (who exactly should use this)
- channels: array of { name: string, priority: "high"|"medium"|"low", rationale: string }
- thirty_day_plan: array of { week: number (1-4), focus: string, actions: string[] }
- content_ideas: string[] (5-7 specific content/post ideas)
- growth_tactics: string[] (4-6 concrete tactics for this specific project)
- kpis: string[] (3-5 metrics to track)

Be specific to this project, not generic. Focus on what actually works for indie/solo builders. Return only valid JSON.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    // Strip markdown code fences if present, then extract JSON object
    const stripped = text.replace(/```(?:json)?\n?/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No JSON in response" }, { status: 500 });

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("Marketing plan generation failed:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
