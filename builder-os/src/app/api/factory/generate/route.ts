import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

const anthropic = new Anthropic();

interface Idea {
  title: string;
  hook: string;
  description: string;
  price: number;
  deliverable: string;
  why_it_wins: string;
}

// ─── Product type generators ───────────────────────────────────────────────

async function generatePromptPack(idea: Idea, niche: string): Promise<string> {
  // Step 1: categories
  const catMsg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are creating a premium prompt pack: "${idea.title}"
Target buyer: ${niche}
Deliverable: ${idea.deliverable}

Generate exactly 8 use-case categories for this prompt pack. Each category should address a distinct daily task or challenge the buyer faces.

Return ONLY a JSON array of 8 strings (category names, 2-5 words each). No markdown.`,
      },
    ],
  });

  const catRaw = (catMsg.content[0] as { text: string }).text.replace(/```(?:json)?\n?/g, "").trim();
  const catMatch = catRaw.match(/\[[\s\S]*\]/);
  const categories: string[] = catMatch ? JSON.parse(catMatch[0]) : ["General Prompts"];

  // Step 2: prompts per category (run sequentially to avoid rate limits)
  const sections: string[] = [];
  for (const category of categories) {
    const promptMsg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are creating a premium prompt pack for: ${niche}
Category: ${category}

Write exactly 40 high-quality AI prompts for this category. Requirements:
- Each prompt is immediately usable — no vague placeholders
- Use [BRACKETS] only for necessary personalization variables
- Each prompt should produce genuinely useful output for a ${niche}
- Vary the format: some direct instructions, some role-play openers, some chain-of-thought
- Be specific, not generic — "Write a cold email to a marketing agency VP who just posted about..." not "Write a cold email"
- Number each prompt (1–40)

Output just the numbered list. No headers, no intro text.`,
        },
      ],
    });
    const content = (promptMsg.content[0] as { text: string }).text.trim();
    sections.push(`═══════════════════════════════════════════════════════════\n${category.toUpperCase()}\n═══════════════════════════════════════════════════════════\n\n${content}`);
  }

  const totalPrompts = sections.length * 40;
  return `${idea.title.toUpperCase()}
${"═".repeat(60)}
${totalPrompts}+ AI Prompts for ${niche}
${idea.hook}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE THIS PACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Find the category that matches your current task
2. Copy the prompt into ChatGPT, Claude, or any AI tool
3. Replace [BRACKET] variables with your specific details
4. Iterate — use "expand on point 3" or "make it more concise"

These prompts are designed to produce usable output on the first try.
Replace generic prompts in your daily workflow with these tested ones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE OF CONTENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${categories.map((c, i) => `${i + 1}. ${c} (40 prompts)`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sections.join("\n\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF ${idea.title.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

async function generateEmailSwipe(idea: Idea, niche: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `You are creating a premium email swipe file: "${idea.title}"
Target buyer: ${niche}
Deliverable: ${idea.deliverable}

Create 25 complete, professional email templates. For each email:
- SUBJECT LINE: [the subject line]
- PREVIEW TEXT: [the preview text, 60-90 chars]
- BODY: [complete email body, ready to use with minor personalization]
- WHEN TO USE: [one sentence on the exact scenario]

Requirements:
- Emails should be ready to send with only [BRACKET] personalization
- Mix formats: short punchy emails (3-5 sentences), medium nurture emails (2-3 paragraphs), longer value emails
- Make subject lines specific and curiosity-driving — not generic
- CTAs should be one clear action, not vague "let me know"
- Cover different scenarios the ${niche} faces (outreach, follow-up, nurture, re-engagement, etc.)
- Number each email (Email 1 of 25, etc.)

Write all 25 emails in full. No truncating.`,
      },
    ],
  });

  const content = (msg.content[0] as { text: string }).text.trim();
  return `${idea.title.toUpperCase()}
${"═".repeat(60)}
25 Ready-to-Send Email Templates for ${niche}
${idea.hook}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the scenario that matches your situation. Copy the email into your email client.
Replace all [BRACKET] variables with specifics. Send. Track what works.

These are starting points — your voice and context will make them stronger.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE EMAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${content}
`;
}

async function generatePdfGuide(idea: Idea, niche: string): Promise<string> {
  // Step 1: outline
  const outlineMsg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Create a detailed outline for: "${idea.title}"
For: ${niche}
Deliverable: ${idea.deliverable}

Create a 10-section guide outline. Each section should be a specific, actionable topic.
Return ONLY JSON array of section titles. No markdown.`,
      },
    ],
  });

  const outlineRaw = (outlineMsg.content[0] as { text: string }).text.replace(/```(?:json)?\n?/g, "").trim();
  const outlineMatch = outlineRaw.match(/\[[\s\S]*\]/);
  const sections: string[] = outlineMatch ? JSON.parse(outlineMatch[0]) : ["Introduction"];

  // Step 2: write the guide
  const guideMsg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `Write a complete, professional guide: "${idea.title}"
For: ${niche}
Sections: ${sections.join(", ")}

Requirements:
- Each section: 200-350 words, specific and actionable
- Include concrete examples, numbers, and specifics — no vague advice
- Write like a practitioner who has done this, not an observer
- Use bullet points and numbered lists where they help clarity
- Each section should answer: what to do, how to do it, and why it matters
- Tone: direct, confident, no fluff

Write the complete guide with all ${sections.length} sections.`,
      },
    ],
  });

  const content = (guideMsg.content[0] as { text: string }).text.trim();
  return `${idea.title.toUpperCase()}
${"═".repeat(60)}
A Practical Guide for ${niche}
${idea.hook}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE OF CONTENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${content}
`;
}

async function generateSocialPack(idea: Idea, niche: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `You are creating a social media content pack: "${idea.title}"
For: ${niche}
Deliverable: ${idea.deliverable}

Create 50 complete, ready-to-post pieces. For each piece:
- POST [number]: [the complete post, ready to use]
- HOOK TYPE: [what makes this post work — curiosity gap, data, story opener, etc.]
- HASHTAGS: [5-10 relevant hashtags]

Requirements:
- Posts should be complete and specific — not templates, actual content
- Vary the format: data posts, story posts, opinion posts, list posts, question posts
- Each should stop the scroll — strong opening line
- Include [PERSONALIZE: ...] only where a specific detail MUST come from the user
- Mix short posts (2-3 lines) and longer ones (5-8 lines)
- All 50 posts should feel distinct — no repetition of angles or formats

Write all 50 posts in full.`,
      },
    ],
  });

  const content = (msg.content[0] as { text: string }).text.trim();
  return `${idea.title.toUpperCase()}
${"═".repeat(60)}
50 Ready-to-Post Pieces for ${niche}
${idea.hook}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy the post. Add any [PERSONALIZE] details. Post. Track engagement.
Rotate through these over 6-8 weeks, then mix and match elements for new variations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${content}
`;
}

async function generateChecklist(idea: Idea, niche: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `Create a comprehensive, actionable checklist/framework: "${idea.title}"
For: ${niche}
Deliverable: ${idea.deliverable}

Requirements:
- 8-12 major sections/categories
- Each section has 8-15 specific, checkable items
- Items should be specific actions, not vague reminders
- Add a brief explanation (1 sentence) after each item where non-obvious
- Include a "common mistakes" section at the end
- Include a "quick reference" summary at the start (top 10 most critical items)
- Total items: 80-120

Format: Clear section headers, checkboxes shown as [ ], explanations indented.`,
      },
    ],
  });

  const content = (msg.content[0] as { text: string }).text.trim();
  return `${idea.title.toUpperCase()}
${"═".repeat(60)}
The Complete Checklist for ${niche}
${idea.hook}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Work through each section in order. Check items as you complete them.
Revisit the Quick Reference section before any major decision.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${content}
`;
}

async function generateAiPlaybook(idea: Idea, niche: string): Promise<string> {
  // Step 1: Define the 8 core workflows for this professional
  const workflowMsg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `You are creating a professional AI playbook: "${idea.title}"
For: ${niche}
Deliverable: ${idea.deliverable}

Identify exactly 8 high-frequency, time-consuming workflows that a ${niche} performs weekly.
Choose workflows where AI dramatically cuts time (30-60+ minutes saved each).
These must be specific professional tasks — not generic "write better" or "save time."

Output ONLY raw JSON — no markdown fences, no commentary, no text before or after.
Start your response with [ and end with ].

[{"workflow": "2-5 word workflow name", "time_saved": "e.g. 45 min/week", "pain": "one sentence on why this is painful without AI"}]`,
    }],
  });

  const wfRaw = (workflowMsg.content[0] as { text: string }).text.replace(/```(?:json)?\n?/g, "").trim();
  const wfMatch = wfRaw.match(/\[[\s\S]*\]/);
  if (!wfMatch) {
    console.error("[factory/generate] Step 1 parse failed. Raw:", wfRaw.slice(0, 500));
    throw new Error("Failed to generate workflow list — please try again");
  }
  const workflows: { workflow: string; time_saved: string; pain: string }[] = JSON.parse(wfMatch[0]);

  // Step 2: Build each workflow section with embedded prompts
  const sections: string[] = [];
  for (const wf of workflows) {
    const sectionMsg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1800,
      messages: [{
        role: "user",
        content: `You are writing one section of a professional AI playbook for: ${niche}

WORKFLOW: ${wf.workflow}
TIME SAVED: ${wf.time_saved}
WHY IT HURTS: ${wf.pain}

Write a complete workflow section with:

1. OVERVIEW (2-3 sentences): What this workflow is, why it matters, how long it used to take
2. THE AI APPROACH (3-4 steps): Exact step-by-step process using AI — be specific about what to do
3. THE PROMPTS (exactly 6 prompts): Each prompt should be:
   - Complete and ready to use
   - Specific to ${niche} — not generic
   - Include [BRACKETS] only for essential variables
   - Label each: "PROMPT 1: [use case name]" then the full prompt
4. PRO TIPS (2-3 bullet points): Specific refinements that improve output quality
5. TIME BREAKDOWN: Before AI vs. after AI in hours/week

Be specific and professional. No fluff. Write as a practitioner.`,
      }],
    });
    const sectionContent = (sectionMsg.content[0] as { text: string }).text.trim();
    sections.push(
      `${"═".repeat(60)}\nWORKFLOW ${sections.length + 1}: ${wf.workflow.toUpperCase()}\nTime saved: ${wf.time_saved}\n${"═".repeat(60)}\n\n${sectionContent}`
    );
  }

  // Step 3: Generate quick reference card
  const qrMsg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Create a "Quick Reference Card" for a ${niche} using this AI playbook.
Workflows covered: ${workflows.map(w => w.workflow).join(", ")}

Write a single-page cheat sheet with:
- One-line reminder for each workflow (what prompt type to use, when to use it)
- Top 3 rules for getting better AI output in a professional context
- 5 common mistakes to avoid when using AI for ${niche} work
- "Start here" recommendation for a complete beginner

Format clearly with headers. Under 300 words.`,
    }],
  });
  const quickRef = (qrMsg.content[0] as { text: string }).text.trim();

  const totalTime = workflows.reduce((sum, w) => {
    const mins = parseInt(w.time_saved) || 30;
    return sum + mins;
  }, 0);

  return `${idea.title.toUpperCase()}
${"═".repeat(60)}
The Complete AI Playbook for ${niche}
${idea.hook}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S INSIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  8 complete AI workflows built specifically for ${niche}
  48 ready-to-use prompts with professional context
  Estimated weekly time savings: ${totalTime}+ minutes
  Quick reference card for daily use

Each workflow includes: step-by-step AI process, 6 embedded
prompts, pro tips, and a before/after time breakdown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE OF WORKFLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${workflows.map((w, i) => `  ${i + 1}. ${w.workflow} — saves ${w.time_saved}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: HOW TO USE THIS PLAYBOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Start with the workflow that costs you the most time this week.
Read the overview, follow the steps, then copy the relevant
prompt into ChatGPT, Claude, or any AI assistant. Fill in the
[BRACKETS] with your specific details. Iterate from there.

Do not try all 8 workflows at once. Master one, then add the next.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE WORKFLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


${sections.join("\n\n\n")}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK REFERENCE CARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${quickRef}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF ${idea.title.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// ─── Also generate Gumroad-ready product copy ──────────────────────────────

async function generateProductCopy(idea: Idea, niche: string, productType: string): Promise<{ title: string; description: string }> {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Write Gumroad product copy for: "${idea.title}"
Target: ${niche}
Type: ${productType.replace(/_/g, " ")}
Deliverable: ${idea.deliverable}
Price: $${idea.price}

Return ONLY JSON (no markdown):
{
  "title": "final product title (max 70 chars)",
  "description": "Gumroad description, 200-280 words. Structure: opening hook (1 sentence), problem (2 sentences), what's inside (bulleted list of 4-6 specific items), who this is for (1 sentence), closing CTA. No hype words like 'amazing' or 'game-changing'. Be specific and direct."
}`,
      },
    ],
  });

  const raw = (msg.content[0] as { text: string }).text.replace(/```(?:json)?\n?/g, "").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { title: idea.title, description: idea.description };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { title: idea.title, description: idea.description };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { idea, niche, product_type } = await req.json();

  if (!idea || !niche || !product_type) {
    return NextResponse.json({ error: "idea, niche, and product_type required" }, { status: 400 });
  }

  try {
    const [content, copy] = await Promise.all([
      (async () => {
        switch (product_type) {
          case "prompt_pack": return generatePromptPack(idea, niche);
          case "email_swipe": return generateEmailSwipe(idea, niche);
          case "pdf_guide": return generatePdfGuide(idea, niche);
          case "social_pack": return generateSocialPack(idea, niche);
          case "checklist": return generateChecklist(idea, niche);
          case "ai_playbook": return generateAiPlaybook(idea, niche);
          default: return generatePromptPack(idea, niche);
        }
      })(),
      generateProductCopy(idea, niche, product_type),
    ]);

    return NextResponse.json({
      content,
      title: copy.title,
      description: copy.description,
      price: idea.price,
      filename: `${copy.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}.txt`,
      char_count: content.length,
      word_count: content.split(/\s+/).length,
    });
  } catch (err) {
    console.error("Factory generate error:", err);
    return NextResponse.json({ error: "Generation failed — check API key" }, { status: 500 });
  }
}
