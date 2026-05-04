import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const PRODUCT_TYPE_CONTEXT: Record<string, string> = {
  prompt_pack:
    "Niche-specific AI prompt libraries. Best price range $17–$49. Include 200–500 prompts organized by use case. The specificity to a profession/niche is the entire value — generic prompt packs are dead.",
  email_swipe:
    "Done-for-you email templates and sequences. Best price range $27–$67. 15–30 complete emails with subject lines, hooks, body copy, and CTAs. Buyers use these word-for-word or lightly edit.",
  pdf_guide:
    "Concise problem-solver PDFs and mini ebooks. Best price range $9–$25. 8–15 pages covering one specific problem end-to-end. Works as tripwire product that leads to upsell.",
  social_pack:
    "Social media content libraries. Best price range $12–$37. 30–50 ready-to-post pieces (captions, hooks, threads) for a specific platform and audience. Volume play — buyers stack these.",
  checklist:
    "Actionable checklists, frameworks, and decision tools. Best price range $7–$29. One-page to multi-page structured references that replace consulting time. High perceived value for price.",
  ai_playbook:
    "Professional AI workflow playbooks for B2B audiences (HR, legal, healthcare, finance, operations). Best price range $39–$79 — the HIGHEST-MARGIN format on Gumroad. 8 complete workflows with embedded prompts and step-by-step implementation. Professional buyers expense these without thinking. Target job titles, not industries. 'The HR Manager's AI Playbook' not 'AI for HR'. Very low competition, high trust threshold means higher price converts better than lower.",
};

export async function POST(req: NextRequest) {
  const { niche, product_type } = await req.json();

  if (!niche?.trim() || !product_type) {
    return NextResponse.json({ error: "niche and product_type required" }, { status: 400 });
  }

  const typeContext = PRODUCT_TYPE_CONTEXT[product_type] ?? PRODUCT_TYPE_CONTEXT.prompt_pack;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are a Gumroad market researcher. Your job is to identify winning digital product ideas for a specific niche that can be 100% AI-generated and sold at scale.

TARGET AUDIENCE: ${niche}
PRODUCT TYPE: ${product_type.replace(/_/g, " ")}
PRODUCT TYPE CONTEXT: ${typeContext}

Market intelligence:
- Hyper-specific wins over generic every time. "500 LinkedIn Prompts for SaaS Founders" outsells "1000 ChatGPT Prompts" by 10x
- Writing & Publishing has the highest revenue-per-product on Gumroad ($15,750 avg) with lowest competition
- Fixed pricing at $17–$49 outperforms pay-what-you-want by 3.6x
- The #1 signal: does this save the buyer 3+ hours of work they hate? If yes, it sells

Generate 5 specific product ideas for selling to: ${niche}

Return ONLY a JSON array (no markdown fences) with exactly 5 objects:
[
  {
    "title": "specific product title (6-10 words max)",
    "hook": "one crisp sentence: who buys this + the specific pain it solves",
    "description": "2-3 sentences: exactly what is included, the format, and the core value. Be specific — say '350 LinkedIn prompts organized into 7 categories' not 'lots of helpful prompts'",
    "price": 27,
    "deliverable": "exactly what Claude will generate to make this product (e.g. '350 prompts across 7 categories' or '25 email templates with subject lines')",
    "why_it_wins": "one sentence on the specific market gap this fills"
  }
]

Price must be realistic integer USD ($7–$97). No hype. Be specific about numbers and formats.`,
      },
    ],
  });

  const raw = (message.content[0] as { type: string; text: string }).text;
  const stripped = raw.replace(/```(?:json)?\n?/g, "").trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return NextResponse.json({ error: "Research parse failed" }, { status: 500 });

  try {
    const ideas = JSON.parse(match[0]);
    return NextResponse.json({ ideas, niche, product_type });
  } catch {
    return NextResponse.json({ error: "Research parse failed" }, { status: 500 });
  }
}
