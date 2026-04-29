import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { projects, tasks, shortTermGoals, longTermGoals } = await req.json();

    const projectSummary = projects
      .map((p: { name: string; status: string; revenue_monthly: number; open_task_count: number }) =>
        `- ${p.name} [${p.status}] $${p.revenue_monthly}/mo | ${p.open_task_count} open tasks`
      )
      .join("\n");

    const taskSummary = tasks.length
      ? tasks
          .map((t: { title: string; project: string; priority: string; status: string }) =>
            `- [${t.project}] ${t.title} (${t.priority} priority, ${t.status})`
          )
          .join("\n")
      : "No open tasks.";

    const shortGoalText = shortTermGoals.length
      ? shortTermGoals.map((g: string) => `- ${g}`).join("\n")
      : "None set.";

    const longGoalText = longTermGoals.length
      ? longTermGoals.map((g: string) => `- ${g}`).join("\n")
      : "None set.";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a strategic advisor for an indie SaaS builder managing multiple projects solo. Generate a focused, realistic weekly game plan.

CURRENT PORTFOLIO:
${projectSummary}

OPEN TASKS:
${taskSummary}

SHORT-TERM GOALS (this week/month):
${shortGoalText}

LONG-TERM GOALS:
${longGoalText}

Generate 6-10 specific, actionable items for this week. Prioritize by:
1. Revenue-generating or monetizing projects first
2. Tasks that unblock progress on stalled projects
3. Quick wins that move things forward
4. Necessary maintenance

Return ONLY a JSON array. Each item must have:
- "title": short action phrase (e.g. "Fix Stripe webhook on Candor", "Submit Body Compass to App Store review")
- "description": 1-2 sentences — why this matters now and the specific next step to take
- "project_name": exact project name from the portfolio, or null for general business tasks
- "priority": integer 1-10 (1 = most critical this week)

Return ONLY the JSON array, no explanation or markdown.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ items });
  } catch (err) {
    console.error("generate-plan error:", err);
    return NextResponse.json({ error: "Plan generation failed" }, { status: 500 });
  }
}
