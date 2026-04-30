import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are an expert product strategist helping an indie builder validate and plan an MVP. Generate a concise, practical MVP outline for this idea.

IDEA: ${title}
DESCRIPTION: ${description || "No description provided."}

Return ONLY a JSON object with these exact keys:
{
  "problem": "One sentence — the core problem this solves",
  "target_user": "Who specifically benefits most (be concrete, not generic)",
  "mvp_features": ["Feature 1", "Feature 2", "Feature 3"],
  "cut_features": ["Nice-to-have but NOT in MVP 1", "Another thing to cut"],
  "risks": ["Risk 1", "Risk 2"],
  "revenue_model": "How this makes money — be specific about pricing tier or model",
  "first_steps": ["Step 1 (this week)", "Step 2", "Step 3"],
  "validation_signal": "What would prove this idea is worth building? (e.g. 5 people pay $X)"
}

Be direct, tactical, and realistic. No fluff. Under 20 words per field.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const outline = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!outline) throw new Error("No valid JSON returned");

    return NextResponse.json({ outline });
  } catch (err) {
    console.error("generate-mvp error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
