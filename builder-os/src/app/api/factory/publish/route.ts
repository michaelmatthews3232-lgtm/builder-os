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
  const fileBytes = Buffer.from(content, "utf-8");
  const safeFilename = (filename ?? "product.txt").replace(/[^a-z0-9._-]/gi, "-");

  const formData = new FormData();
  const blob = new Blob([fileBytes], { type: "text/plain; charset=utf-8" });
  formData.append("file", blob, safeFilename);

  const uploadRes = await fetch(`https://api.gumroad.com/v2/products/${productId}/product_files`, {
    method: "POST",
    headers: bearerHeaders,
    body: formData,
  });

  let fileUploaded = uploadRes.ok;
  let uploadWarning: string | null = null;

  if (!uploadRes.ok) {
    // Product exists but file upload failed — common with some API versions
    // User can upload manually; don't block the whole flow
    uploadWarning = "Product created but file upload failed — upload the .txt file manually in Gumroad dashboard";
    fileUploaded = false;
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
