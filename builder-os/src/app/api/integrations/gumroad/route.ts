import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GumroadSale {
  id: string;
  email: string;
  full_name: string | null;
  product_name: string;
  price: number; // cents
  currency: string;
  created_at: string;
  daystamp: string; // "YYYY-MM-DD"
  order_number: number;
  refunded: boolean;
  disputed: boolean;
  chargedback: boolean;
}

export async function GET() {
  try {
    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "gumroad")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "Gumroad not configured" }, { status: 400 });
    }

    const res = await fetch("https://api.gumroad.com/v2/sales", {
      headers: { Authorization: `Bearer ${setting.token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { message?: string }).message ?? "Gumroad API error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (!data.success) {
      return NextResponse.json({ error: data.message ?? "Gumroad API error" }, { status: 400 });
    }

    const all: GumroadSale[] = (data.sales ?? []).filter(
      (s: GumroadSale) => !s.refunded && !s.chargedback
    );

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    const revenueTotal = all.reduce((sum, s) => sum + s.price / 100, 0);
    const thisMonth = all.filter((s) => s.daystamp?.startsWith(currentMonth));
    const revenueThisMonth = thisMonth.reduce((sum, s) => sum + s.price / 100, 0);

    return NextResponse.json({
      order_count: all.length,
      revenue_total: Math.round(revenueTotal * 100) / 100,
      revenue_this_month: Math.round(revenueThisMonth * 100) / 100,
      recent: all.slice(0, 10).map((s) => ({
        id: s.id,
        buyer: s.full_name || s.email,
        email: s.email,
        product: s.product_name,
        amount: s.price / 100,
        date: s.daystamp,
        order_number: s.order_number,
      })),
    });
  } catch (err) {
    console.error("Gumroad integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
