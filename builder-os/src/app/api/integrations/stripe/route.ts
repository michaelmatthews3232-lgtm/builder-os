import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function toMonthlyAmount(amount: number, currency: string, interval: string, intervalCount: number): number {
  const dollars = currency === "usd" ? amount / 100 : amount / 100;
  if (interval === "month") return dollars / intervalCount;
  if (interval === "year") return dollars / (12 * intervalCount);
  if (interval === "week") return (dollars * 52) / 12 / intervalCount;
  if (interval === "day") return (dollars * 365) / 12 / intervalCount;
  return 0;
}

export async function GET() {
  try {
    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "stripe")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "Stripe integration not configured" }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${setting.token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Fetch active subscriptions (paginated)
    let allSubs: Record<string, unknown>[] = [];
    let hasMore = true;
    let startingAfter: string | null = null;

    while (hasMore) {
      const url = new URL("https://api.stripe.com/v1/subscriptions");
      url.searchParams.set("status", "active");
      url.searchParams.set("limit", "100");
      url.searchParams.set("expand[]", "data.items.data.price");
      if (startingAfter) url.searchParams.set("starting_after", startingAfter);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: err.error?.message ?? "Stripe API error" }, { status: res.status });
      }
      const page = await res.json();
      allSubs = allSubs.concat(page.data ?? []);
      hasMore = page.has_more;
      if (hasMore && page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      }
    }

    // Compute MRR per product
    const productMrr: Record<string, { name: string; mrr: number; subs: number }> = {};
    let totalMrr = 0;

    for (const sub of allSubs) {
      const items = (sub.items as { data: Record<string, unknown>[] })?.data ?? [];
      for (const item of items) {
        const price = item.price as Record<string, unknown> | null;
        if (!price || !price.recurring) continue;
        const recurring = price.recurring as { interval: string; interval_count: number };
        const monthly = toMonthlyAmount(
          price.unit_amount as number ?? 0,
          price.currency as string ?? "usd",
          recurring.interval,
          recurring.interval_count
        ) * ((item.quantity as number) ?? 1);

        const product = price.product as Record<string, unknown> | string;
        const productId = typeof product === "string" ? product : (product?.id as string ?? "unknown");
        const productName = typeof product === "object" ? (product?.name as string ?? "Unknown product") : productId;

        if (!productMrr[productId]) {
          productMrr[productId] = { name: productName, mrr: 0, subs: 0 };
        }
        productMrr[productId].mrr += monthly;
        productMrr[productId].subs += 1;
        totalMrr += monthly;
      }
    }

    // Fetch customer count
    const custRes = await fetch("https://api.stripe.com/v1/customers?limit=1", { headers });
    const custData = custRes.ok ? await custRes.json() : null;
    const totalCustomers = custData?.total_count ?? null;

    return NextResponse.json({
      mrr: Math.round(totalMrr * 100) / 100,
      active_subscriptions: allSubs.length,
      total_customers: totalCustomers,
      products: Object.entries(productMrr)
        .map(([id, p]) => ({ id, name: p.name, mrr: Math.round(p.mrr * 100) / 100, subscriptions: p.subs }))
        .sort((a, b) => b.mrr - a.mrr),
    });
  } catch (err) {
    console.error("Stripe integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
