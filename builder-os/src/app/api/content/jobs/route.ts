import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("content_jobs")
    .select("*, project:projects(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { project_id, product_type, brief, templates, reference_image_url } = body;

  if (!product_type || !brief?.trim()) {
    return NextResponse.json({ error: "product_type and brief are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("content_jobs")
    .insert({
      project_id: project_id || null,
      status: "pending",
      product_type,
      brief: brief.trim(),
      templates: templates?.length ? templates : null,
      reference_image_url: reference_image_url?.trim() || null,
    })
    .select("*, project:projects(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
