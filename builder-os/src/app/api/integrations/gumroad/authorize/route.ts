import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const REDIRECT_URI = "https://builder-os-xi.vercel.app/api/integrations/gumroad/callback";

export async function GET() {
  const { data: setting } = await supabase
    .from("integration_settings")
    .select("token")
    .eq("service", "gumroad")
    .single();

  let clientId: string | null = null;
  try {
    const parsed = JSON.parse(setting?.token ?? "{}");
    clientId = parsed.client_id;
  } catch { /* no credentials yet */ }

  if (!clientId) {
    return NextResponse.json({ error: "Gumroad Client ID not saved yet" }, { status: 400 });
  }

  const url = new URL("https://gumroad.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");

  return NextResponse.json({ url: url.toString() });
}
