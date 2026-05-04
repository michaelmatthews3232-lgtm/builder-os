import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const anthropic = new Anthropic();

function toMonthly(amount: number, cycle: string): number {
  if (cycle === "monthly") return amount;
  if (cycle === "annual") return amount / 12;
  return 0;
}

export async function POST() {
  try {
    const [
      { data: projects },
      { data: tasks },
      { data: expenses },
      { data: contractors },
      { data: payments },
      { data: snapshots },
      { data: leads },
      { data: integrations },
    ] = await Promise.all([
      supabase.from("projects").select("*"),
      supabase.from("tasks").select("*, project:projects(name, status)"),
      supabase.from("expenses").select("*").eq("active", true),
      supabase.from("contractors").select("*"),
      supabase.from("contractor_payments").select("*").order("paid_date", { ascending: false }).limit(100),
      supabase.from("finance_snapshots").select("*").order("month", { ascending: false }).limit(6),
      supabase.from("project_sales").select("*"),
      supabase.from("integration_settings").select("service, enabled, token"),
    ]);

    const activeProjects = (projects ?? []).filter(p => p.status !== "archived");
    const openTasks = (tasks ?? []).filter(t => t.status !== "done");
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Finance calcs
    const totalMRR = activeProjects.reduce((s, p) => s + (p.revenue_monthly || 0), 0);
    const monthlyExpenses = (expenses ?? []).reduce((s, e) => s + toMonthly(e.amount, e.billing_cycle), 0);
    const contractorThisMonth = (payments ?? [])
      .filter(p => p.paid_date?.startsWith(currentMonth))
      .reduce((s, p) => s + p.amount, 0);
    const net = totalMRR - monthlyExpenses - contractorThisMonth;

    // Task analysis
    const blockedTasks = openTasks.filter(t => t.is_blocked);
    const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.is_blocked);
    const highPriority = openTasks.filter(t => t.priority === "high" && !t.is_blocked);

    // Sales analysis
    const totalLeads = (leads ?? []).length;
    const converted = (leads ?? []).filter(l => l.status === "converted").length;

    // Optionally fetch live Stripe data
    let stripeSummary = "";
    const stripeInteg = (integrations ?? []).find(i => i.service === "stripe" && i.enabled && i.token);
    if (stripeInteg) {
      try {
        const res = await fetch("https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.items.data.price", {
          headers: { Authorization: `Bearer ${stripeInteg.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const subCount = (data.data ?? []).length;
          stripeSummary = `Stripe: ${subCount} active subscriptions`;
        }
      } catch { /* skip */ }
    }

    // Optionally fetch live Gumroad data
    let gumroadSummary = "";
    const gumroadInteg = (integrations ?? []).find(i => i.service === "gumroad" && i.enabled && i.token);
    if (gumroadInteg) {
      try {
        let token = gumroadInteg.token;
        try { const p = JSON.parse(token); token = p.access_token || token; } catch { /* plain token */ }
        const res = await fetch("https://api.gumroad.com/v2/sales", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const allSales = (data.sales ?? []).filter((s: { refunded: boolean; chargedback: boolean }) => !s.refunded && !s.chargedback);
          const gmv = allSales.reduce((s: number, sale: { price: number }) => s + sale.price / 100, 0);
          const thisMonthSales = allSales.filter((s: { daystamp?: string }) => s.daystamp?.startsWith(currentMonth));
          const thisMonthGmv = thisMonthSales.reduce((s: number, sale: { price: number }) => s + sale.price / 100, 0);
          gumroadSummary = `Gumroad: ${allSales.length} total orders, $${gmv.toFixed(2)} all-time, $${thisMonthGmv.toFixed(2)} this month`;
        }
      } catch { /* skip */ }
    }

    // Connected integrations
    const connectedIntegrations = (integrations ?? []).filter(i => i.enabled).map(i => i.service);

    const context = `
TODAY: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

== PROJECTS (${activeProjects.length} active, ${(projects ?? []).filter(p => p.status === "archived").length} archived) ==
${activeProjects.map(p => {
  const pTasks = openTasks.filter(t => t.project_id === p.id);
  const pLeads = (leads ?? []).filter(l => l.project_id === p.id);
  const pConverted = pLeads.filter(l => l.status === "converted").length;
  const pBlocked = pTasks.filter(t => t.is_blocked).length;
  return `• ${p.name} [${p.status.toUpperCase()}]
  Revenue: $${p.revenue_monthly}/mo | Open tasks: ${pTasks.length}${pBlocked > 0 ? ` (${pBlocked} blocked)` : ""} | Leads: ${pConverted}/${pLeads.length} converted
  Description: ${p.description || "none"}`;
}).join("\n")}

== FINANCE (current month: ${currentMonth}) ==
• MRR: $${totalMRR.toFixed(2)}
• Monthly expenses: $${monthlyExpenses.toFixed(2)}
• Contractor spend this month: $${contractorThisMonth.toFixed(2)}
• Net this month: $${net.toFixed(2)} (${net >= 0 ? "profitable" : "LOSING MONEY"})
${(snapshots ?? []).length > 0 ? `\nRecent months:\n${(snapshots ?? []).slice(0, 4).map(s => `  ${s.month}: Revenue $${s.revenue} | Expenses $${s.expenses} | Net $${s.net}`).join("\n")}` : ""}

== TASKS ==
• Total open: ${openTasks.length} | High priority: ${highPriority.length} | Overdue: ${overdueTasks.length} | Blocked: ${blockedTasks.length}
${blockedTasks.length > 0 ? `Blocked tasks:\n${blockedTasks.map(t => `  - "${t.title}" [${t.project?.name || "no project"}] — ${t.blocked_notes || t.blocked_reason || "unspecified"}`).join("\n")}` : ""}
${overdueTasks.length > 0 ? `Overdue tasks:\n${overdueTasks.slice(0, 5).map(t => `  - "${t.title}" [${t.project?.name || "no project"}] due ${t.due_date}`).join("\n")}` : ""}
${highPriority.length > 0 ? `High priority:\n${highPriority.slice(0, 5).map(t => `  - "${t.title}" [${t.project?.name || "no project"}]`).join("\n")}` : ""}

== SALES ==
• Total leads across all projects: ${totalLeads} | Converted: ${converted} (${totalLeads > 0 ? Math.round(converted / totalLeads * 100) : 0}% rate)
${activeProjects.map(p => {
  const pLeads = (leads ?? []).filter(l => l.project_id === p.id);
  if (!pLeads.length) return "";
  const statusCounts = pLeads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  return `  ${p.name}: ${Object.entries(statusCounts).map(([s, c]) => `${c} ${s}`).join(", ")}`;
}).filter(Boolean).join("\n")}

== CONTRACTORS ==
${(contractors ?? []).length > 0 ? contractors!.map(c => `• ${c.name} (${c.role || "no role"}) — ${c.status}${c.project_id ? " [assigned]" : " [library]"}`).join("\n") : "None"}

== INTEGRATIONS CONNECTED ==
${connectedIntegrations.length > 0 ? connectedIntegrations.join(", ") : "None"}
${stripeSummary ? `\n${stripeSummary}` : ""}
${gumroadSummary ? `\n${gumroadSummary}` : ""}
    `.trim();

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2500,
      messages: [{
        role: "user",
        content: `You are the strategic advisor for an indie builder/solo entrepreneur. Review their complete business dashboard and give sharp, direct, actionable insights. No fluff — reference specific numbers and project names.

${context}

Return a JSON object with EXACTLY these keys:
{
  "health_score": <integer 1-10>,
  "health_reasoning": <string: 1 sentence explaining the score>,
  "summary": <string: 2-3 sentences on the overall business state right now>,
  "revenue_analysis": <string: specific analysis of the revenue picture, trends, risks>,
  "alerts": <string[]: 2-4 things needing immediate attention, specific with numbers>,
  "opportunities": <array of { "title": string, "action": string, "impact": "high"|"medium" }>,
  "bottlenecks": <string[]: 2-3 things actively slowing progress>,
  "this_week": <string[]: exactly 3 specific actions, name actual projects/tasks>,
  "project_spotlight": { "name": string, "insight": string }
}

Return only valid JSON. No markdown fences.`,
      }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const stripped = raw.replace(/```(?:json)?\n?/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "AI response parse failed" }, { status: 500 });

    const brief = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      brief,
      generated_at: new Date().toISOString(),
      data_summary: {
        projects: activeProjects.length,
        open_tasks: openTasks.length,
        mrr: totalMRR,
        net,
      },
    });
  } catch (err) {
    console.error("AI brief error:", err);
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 });
  }
}
