import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { title, description, projectName, projectStatus } = await req.json();

  const prompt = `You are a productivity coach for indie builders. Break down this task into concrete, executable steps.

Task: ${title}
Project: ${projectName} (${projectStatus})
Description: ${description || "No description provided"}

Return a JSON object with:
- steps: string[] (5-8 specific, actionable steps — each step should be one clear action, not vague advice)
- why_important: string (1 sentence: why this task matters right now for the business)
- estimated_time: string (realistic total time estimate, e.g. "45 minutes", "2-3 hours")

Be concrete. Steps should be things you can literally do, not strategy. Return only valid JSON.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const stripped = text.replace(/```(?:json)?\n?/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "No JSON in response" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Focus steps generation failed:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
