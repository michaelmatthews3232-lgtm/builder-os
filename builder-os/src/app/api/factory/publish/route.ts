import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getGumroadToken(): Promise<string> {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("token, enabled")
    .eq("service", "gumroad")
    .single();

  if (error || !data?.enabled || !data?.token) {
    throw new Error("Gumroad not connected — add your Gumroad token in Integrations");
  }

  let token = data.token;
  try {
    const parsed = JSON.parse(token);
    token = parsed.access_token || token;
  } catch { /* plain token */ }

  return token;
}

export async function POST(req: NextRequest) {
  const { title, description, price_cents, content, filename } = await req.json();

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getGumroadToken();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const bearerHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // Step 1: Create the product (draft)
  const productForm = new URLSearchParams({
    name: title.slice(0, 255),
    description: description ?? "",
    price: String(price_cents ?? 2700),
    published: "false",
  });

  const createRes = await fetch("https://api.gumroad.com/v2/products", {
    method: "POST",
    headers: { ...bearerHeaders, "Content-Type": "application/x-www-form-urlencoded" },
    body: productForm.toString(),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? `Gumroad product creation failed (${createRes.status})` },
      { status: 502 }
    );
  }

  const createData = await createRes.json();
  if (!createData.success || !createData.product?.id) {
    return NextResponse.json({ error: createData.message ?? "Gumroad error" }, { status: 502 });
  }

  const productId: string = createData.product.id;
  const productUrl: string = createData.product.short_url ?? `https://app.gumroad.com/products/${productId}/edit`;

  // Step 2: Upload the content file
  // Build multipart body manually — more reliable than FormData in Node.js serverless
  const safeFilename = (filename ?? "product.txt").replace(/[^a-z0-9._-]/gi, "-");
  const fileBytes = Buffer.from(content, "utf-8");
  const boundary = `FormBoundary${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeFilename}"\r\n` +
    `Content-Type: text/plain\r\n\r\n`,
    "utf-8"
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
  const multipartBody = Buffer.concat([preamble, fileBytes, epilogue]);

  const uploadRes = await fetch(`https://api.gumroad.com/v2/products/${productId}/product_files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(multipartBody.length),
    },
    body: multipartBody,
  });

  let fileUploaded = uploadRes.ok;
  let uploadWarning: string | null = null;

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text().catch(() => "");
    console.error(`[factory/publish] Gumroad file upload ${uploadRes.status}:`, errBody.slice(0, 300));

    // Try alternative endpoint (some API versions use /files instead of /product_files)
    const uploadRes2 = await fetch(`https://api.gumroad.com/v2/products/${productId}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(multipartBody.length),
      },
      body: multipartBody,
    });

    if (uploadRes2.ok) {
      fileUploaded = true;
    } else {
      const err2 = await uploadRes2.text().catch(() => "");
      console.error(`[factory/publish] Gumroad alt upload ${uploadRes2.status}:`, err2.slice(0, 300));
      uploadWarning = "Product created — click \"Download .txt\" below and upload the file manually in the Gumroad editor (Files tab)";
      fileUploaded = false;
    }
  }

  // Step 3: Return result
  return NextResponse.json({
    product_id: productId,
    product_url: productUrl,
    edit_url: `https://app.gumroad.com/products/${productId}/edit`,
    file_uploaded: fileUploaded,
    warning: uploadWarning,
    status: "draft",
  });
}
