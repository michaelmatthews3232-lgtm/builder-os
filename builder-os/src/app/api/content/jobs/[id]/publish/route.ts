import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ETSY_API = "https://openapi.etsy.com/v3";

// Etsy taxonomy by product type (draft listings don't strictly need it, but helps)
const ETSY_TAXONOMY: Record<string, number> = {
  soap: 494,
  candle: 5,
  jewelry: 68887433,
  staging: 67,
};

async function publishToEtsy(job: {
  id: string;
  brief: string;
  product_type: string;
  approved_images: string[];
}): Promise<{ listing_id: string; url: string }> {
  const { data: setting } = await supabase
    .from("integration_settings")
    .select("token, enabled")
    .eq("service", "etsy")
    .single();

  if (!setting?.enabled || !setting?.token) throw new Error("Etsy not connected");

  let creds: { keystring?: string; access_token?: string; shop_id?: number } = {};
  try {
    creds = JSON.parse(setting.token);
  } catch {
    throw new Error("Invalid Etsy token");
  }
  if (!creds.keystring || !creds.access_token || !creds.shop_id) {
    throw new Error("Etsy OAuth not completed — authorize Etsy in Integrations");
  }

  const headers = {
    "x-api-key": creds.keystring,
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };

  // Create draft listing
  const title = job.brief.length > 140 ? job.brief.slice(0, 137) + "..." : job.brief;
  const listingRes = await fetch(
    `${ETSY_API}/application/shops/${creds.shop_id}/listings`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        description: job.brief,
        price: 0,
        quantity: 1,
        taxonomy_id: ETSY_TAXONOMY[job.product_type] ?? 1,
        who_made: "i_did",
        when_made: "made_to_order",
        is_supply: false,
        state: "draft",
      }),
    }
  );

  if (!listingRes.ok) {
    const err = await listingRes.text();
    throw new Error(`Etsy listing failed: ${err.slice(0, 200)}`);
  }

  const listing = await listingRes.json();
  const listingId: string = String(listing.listing_id);

  // Upload each approved image
  for (const imgUrl of job.approved_images.slice(0, 10)) {
    try {
      // Fetch image bytes
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) continue;
      const imgBuffer = await imgRes.arrayBuffer();
      const imgBytes = Buffer.from(imgBuffer);
      const imgBase64 = imgBytes.toString("base64");

      // Etsy image upload expects multipart/form-data — construct it manually
      const boundary = `----FormBoundary${Date.now()}`;
      const part = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="image"; filename="photo.jpg"`,
        `Content-Type: image/jpeg`,
        `Content-Transfer-Encoding: base64`,
        "",
        imgBase64,
        `--${boundary}--`,
      ].join("\r\n");

      await fetch(
        `${ETSY_API}/application/shops/${creds.shop_id}/listings/${listingId}/images`,
        {
          method: "POST",
          headers: {
            "x-api-key": creds.keystring,
            Authorization: `Bearer ${creds.access_token}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: part,
        }
      );
    } catch {
      // continue — best-effort image upload
    }
  }

  return {
    listing_id: listingId,
    url: `https://www.etsy.com/your-shop/edit/${listingId}`,
  };
}

async function publishToGumroad(job: {
  brief: string;
  product_type: string;
}): Promise<{ product_id: string; url: string }> {
  const { data: setting } = await supabase
    .from("integration_settings")
    .select("token, enabled")
    .eq("service", "gumroad")
    .single();

  if (!setting?.enabled || !setting?.token) throw new Error("Gumroad not connected");

  let token = setting.token;
  try {
    const parsed = JSON.parse(token);
    token = parsed.access_token || token;
  } catch { /* plain token */ }

  const title = job.brief.length > 80 ? job.brief.slice(0, 77) + "..." : job.brief;

  const form = new URLSearchParams({
    name: title,
    description: job.brief,
    price: "0",
    published: "false",
  });

  const res = await fetch("https://api.gumroad.com/v2/products", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Gumroad product creation failed");
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Gumroad error");

  return {
    product_id: data.product.id,
    url: `https://app.gumroad.com/products/${data.product.id}/edit`,
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { platform } = await req.json();
  if (platform !== "etsy" && platform !== "gumroad") {
    return NextResponse.json({ error: "platform must be etsy or gumroad" }, { status: 400 });
  }

  // Load the job
  const { data: job, error: jobErr } = await supabase
    .from("content_jobs")
    .select("*")
    .eq("id", params.id)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!job.approved_images?.length) {
    return NextResponse.json({ error: "No approved images — approve at least one image first" }, { status: 400 });
  }

  try {
    const result = platform === "etsy"
      ? await publishToEtsy(job)
      : await publishToGumroad(job);

    const published_to = { ...(job.published_to ?? {}), [platform]: result };
    const { data: updated, error: updateErr } = await supabase
      .from("content_jobs")
      .update({
        published_to,
        status: "published",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*, project:projects(name)")
      .single();

    if (updateErr) throw new Error(updateErr.message);
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
