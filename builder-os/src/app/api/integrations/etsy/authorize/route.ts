import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://builder-os-xi.vercel.app";
const REDIRECT_URI = `${BASE_URL}/api/integrations/etsy/callback`;
const SCOPES = "listings_r listings_w shops_r profile_r";

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function GET() {
  // Load saved keystring
  const { data: setting } = await supabase
    .from("integration_settings")
    .select("token")
    .eq("service", "etsy")
    .single();

  let keystring: string | null = null;
  try {
    const parsed = JSON.parse(setting?.token ?? "{}");
    keystring = parsed.keystring;
  } catch { /* not saved yet */ }

  if (!keystring) {
    return NextResponse.json({ error: "Save your Etsy Keystring first" }, { status: 400 });
  }

  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("hex");

  // Persist PKCE verifier + state until callback
  await supabase.from("integration_settings").upsert(
    {
      service: "etsy_pkce",
      token: JSON.stringify({ verifier, state }),
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service" }
  );

  const url = new URL("https://www.etsy.com/oauth/connect");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("keystring", keystring);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.json({ url: url.toString() });
}
