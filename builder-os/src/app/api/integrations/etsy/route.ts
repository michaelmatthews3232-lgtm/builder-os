import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ETSY_API = "https://openapi.etsy.com/v3";

interface EtsyReceipt {
  receipt_id: number;
  status: string;
  total_price: { amount: number; divisor: number; currency_code: string };
  buyer_user_id: number;
  buyer_email: string;
  name: string;
  create_timestamp: number;
  transactions: { title: string }[];
  is_canceled: boolean;
}

export async function GET() {
  try {
    const { data: setting } = await supabase
      .from("integration_settings")
      .select("token, enabled")
      .eq("service", "etsy")
      .single();

    if (!setting?.enabled || !setting?.token) {
      return NextResponse.json({ error: "Etsy not configured" }, { status: 400 });
    }

    let creds: { keystring?: string; access_token?: string; shop_id?: number } = {};
    try {
      creds = JSON.parse(setting.token);
    } catch {
      return NextResponse.json({ error: "Invalid Etsy token format" }, { status: 400 });
    }

    if (!creds.keystring || !creds.access_token || !creds.shop_id) {
      return NextResponse.json({ error: "Etsy OAuth not completed — click Authorize" }, { status: 400 });
    }

    const headers = {
      "x-api-key": creds.keystring,
      Authorization: `Bearer ${creds.access_token}`,
    };

    // Fetch shop info and receipts in parallel
    const [shopRes, receiptsRes] = await Promise.all([
      fetch(`${ETSY_API}/application/shops/${creds.shop_id}`, { headers }),
      fetch(`${ETSY_API}/application/shops/${creds.shop_id}/receipts?limit=100&was_paid=true`, { headers }),
    ]);

    if (!shopRes.ok || !receiptsRes.ok) {
      return NextResponse.json({ error: "Etsy API error — token may need refreshing" }, { status: 502 });
    }

    const shop = await shopRes.json();
    const receiptsData = await receiptsRes.json();

    const all: EtsyReceipt[] = (receiptsData.results ?? []).filter(
      (r: EtsyReceipt) => !r.is_canceled && r.status !== "canceled"
    );

    const currentMonth = new Date().toISOString().slice(0, 7);

    const toUsd = (r: EtsyReceipt) => r.total_price.amount / r.total_price.divisor;

    const revenueTotal = all.reduce((sum, r) => sum + toUsd(r), 0);
    const thisMonth = all.filter((r) => {
      const d = new Date(r.create_timestamp * 1000).toISOString().slice(0, 7);
      return d === currentMonth;
    });
    const revenueThisMonth = thisMonth.reduce((sum, r) => sum + toUsd(r), 0);

    return NextResponse.json({
      shop_name: shop.shop_name,
      listing_active_count: shop.listing_active_count ?? 0,
      order_count: all.length,
      revenue_total: Math.round(revenueTotal * 100) / 100,
      revenue_this_month: Math.round(revenueThisMonth * 100) / 100,
      recent: all.slice(0, 10).map((r) => ({
        id: r.receipt_id,
        buyer: r.name || r.buyer_email,
        email: r.buyer_email,
        product: r.transactions?.[0]?.title ?? "Etsy Order",
        amount: Math.round(toUsd(r) * 100) / 100,
        date: new Date(r.create_timestamp * 1000).toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    console.error("Etsy integration error:", err);
    return NextResponse.json({ error: "Integration failed" }, { status: 500 });
  }
}
