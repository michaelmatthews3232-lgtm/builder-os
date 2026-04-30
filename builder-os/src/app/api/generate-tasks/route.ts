import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { projectName, description, status, existingTasks } = await req.json();

    const existingText = existingTasks?.length
      ? `\nExisting tasks (don't duplicate):\n${existingTasks.map((t: string) => `- ${t}`).join("\n")}`
      : "";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a practical project manager helping an indie SaaS builder. Generate a focused task list for this project.

PROJECT: ${projectName}
STATUS: ${status}
DESCRIPTION: ${description || "No description."}${existingText}

Generate 6-10 specific, actionable tasks appropriate for a solo builder at this stage.
- If status is "idea" or "planned": focus on validation, market research, initial setup
- If status is "building": focus on core features, technical tasks, testing
- If status is "monetizing": focus on growth, bug fixes, customer success
- If status is "scaling": focus on optimization, automation, hiring

Return ONLY a JSON array. Each task must have:
- "title": short action phrase (max 10 words)
- "description": 1 sentence — what to do and why (optional, can be null)
- "priority": "high", "medium", or "low"

Return ONLY the JSON array, no explanation.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("generate-tasks error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
