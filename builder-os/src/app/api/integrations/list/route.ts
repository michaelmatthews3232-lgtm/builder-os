import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from("integration_settings")
    .select("service, enabled, metadata, updated_at");

  return NextResponse.json({ integrations: data ?? [] });
}

export async function POST(req: Request) {
  const { service, token, enabled } = await req.json();
  if (!service) return NextResponse.json({ error: "Missing service" }, { status: 400 });

  await supabase
    .from("integration_settings")
    .upsert({ service, token, enabled: enabled ?? true, updated_at: new Date().toISOString() }, { onConflict: "service" });

  return NextResponse.json({ ok: true });
}
