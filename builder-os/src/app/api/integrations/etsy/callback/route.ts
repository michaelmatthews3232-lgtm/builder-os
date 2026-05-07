import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://builder-os-xi.vercel.app";
const REDIRECT_URI = `${BASE_URL}/api/integrations/etsy/callback`;
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_API = "https://openapi.etsy.com/v3";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=etsy_denied`);
  }

  // Load PKCE verifier and saved keystring
  const [pkceRow, etsyRow] = await Promise.all([
    supabase.from("integration_settings").select("token").eq("service", "etsy_pkce").single(),
    supabase.from("integration_settings").select("token").eq("service", "etsy").single(),
  ]);

  let pkce: { verifier: string; state: string } = { verifier: "", state: "" };
  try { pkce = JSON.parse(pkceRow.data?.token ?? "{}"); } catch { /* parse error */ }

  let creds: { keystring?: string } = {};
  try { creds = JSON.parse(etsyRow.data?.token ?? "{}"); } catch { /* parse error */ }

  if (!pkce.verifier || pkce.state !== state) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=etsy_state_mismatch`);
  }

  if (!creds.keystring) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=etsy_no_keystring`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.keystring,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: pkce.verifier,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Etsy token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${BASE_URL}/integrations?error=etsy_token_failed`);
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token } = tokenData;

  if (!access_token) {
    return NextResponse.redirect(`${BASE_URL}/integrations?error=etsy_no_token`);
  }

  // Get the user's shop ID
  const meRes = await fetch(`${ETSY_API}/application/users/me`, {
    headers: { "x-api-key": creds.keystring, Authorization: `Bearer ${access_token}` },
  });

  let shopId: number | null = null;
  if (meRes.ok) {
    const me = await meRes.json();
    const shopsRes = await fetch(`${ETSY_API}/application/users/${me.user_id}/shops`, {
      headers: { "x-api-key": creds.keystring, Authorization: `Bearer ${access_token}` },
    });
    if (shopsRes.ok) {
      const shops = await shopsRes.json();
      shopId = shops.results?.[0]?.shop_id ?? null;
    }
  }

  // Save full credentials and clean up PKCE row
  await Promise.all([
    supabase.from("integration_settings").upsert(
      {
        service: "etsy",
        token: JSON.stringify({ keystring: creds.keystring, access_token, refresh_token, shop_id: shopId }),
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service" }
    ),
    supabase.from("integration_settings").delete().eq("service", "etsy_pkce"),
  ]);

  return NextResponse.redirect(`${BASE_URL}/integrations?connected=etsy`);
}
