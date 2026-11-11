import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { kitchenSoldOutSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = kitchenSoldOutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid menu item", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await getSupabase()
    .from("menu_items")
    .update({ stock: 0 })
    .eq("id", parsed.data.menu_item_id)
    .select("id, name, stock")
    .maybeSingle();
  if (error) {
    console.error("[POST /api/kitchen/stock]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: `Menu item ${parsed.data.menu_item_id} not found.` }, { status: 404 });
  }

  return NextResponse.json({ item: data });
}
