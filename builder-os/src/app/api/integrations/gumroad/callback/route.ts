import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://builder-os-xi.vercel.app";
const REDIRECT_URI = `${BASE_URL}/api/integrations/gumroad/callback`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=gumroad_denied`);
  }

  // Load saved credentials
  const { data: setting } = await supabase
    .from("integration_settings")
    .select("token")
    .eq("service", "gumroad")
    .single();

  let creds: { client_id: string; client_secret: string; access_token?: string } = {
    client_id: "",
    client_secret: "",
  };
  try {
    creds = { ...creds, ...JSON.parse(setting?.token ?? "{}") };
  } catch { /* parse error */ }

  if (!creds.client_id || !creds.client_secret) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=gumroad_no_credentials`);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://api.gumroad.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Gumroad token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${BASE_URL}/integrations?error=gumroad_token_failed`);
  }

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;

  if (!accessToken) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=gumroad_no_token`);
  }

  // Save access token alongside credentials
  await supabase.from("integration_settings").upsert(
    {
      service: "gumroad",
      token: JSON.stringify({ client_id: creds.client_id, client_secret: creds.client_secret, access_token: accessToken }),
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service" }
  );

  return NextResponse.redirect(`${BASE_URL}/integrations?connected=gumroad`);
}
