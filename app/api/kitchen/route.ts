import { NextResponse } from "next/server";
import { formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";
import { kitchenStatusUpdateSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("orders")
    .select(
      "id, status, total, created_at, student:wallets(name), pickup_slot:pickup_slots(slot_time), order_items(quantity, menu_item:menu_items(name))"
    )
    .in("status", ["placed", "preparing", "ready"])
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[GET /api/kitchen]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = data.map((order) => {
    const student = Array.isArray(order.student) ? order.student[0] : order.student;
    const pickup = Array.isArray(order.pickup_slot) ? order.pickup_slot[0] : order.pickup_slot;
    const items = order.order_items.flatMap((item) => {
      const menuItem = Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item;
      return menuItem ? [{ name: menuItem.name, quantity: item.quantity }] : [];
    });

    return {
      id: order.id,
      status: order.status,
      total: order.total,
      created_at: order.created_at,
      student_name: student?.name ?? null,
      pickup_time: pickup ? formatSlot(pickup.slot_time) : null,
      items,
    };
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = kitchenStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order status update", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { order_id, status } = parsed.data;
  const supabase = getSupabase();
  const { data: current, error: readError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", order_id)
    .maybeSingle();
  if (readError) {
    console.error("[POST /api/kitchen] read order", readError.message);
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: `Order ${order_id} not found.` }, { status: 404 });
  }

  const expectedStatus =
    current.status === "placed"
      ? "preparing"
      : current.status === "preparing"
        ? "ready"
        : current.status === "ready"
          ? "collected"
          : null;
  if (expectedStatus !== status) {
    return NextResponse.json(
      { error: `Order cannot move from ${current.status} to ${status}.` },
      { status: 409 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", order_id)
    .eq("status", current.status)
    .select("id, status")
    .maybeSingle();
  if (updateError) {
    console.error("[POST /api/kitchen] update order", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Order status changed before this update could be applied." }, { status: 409 });
  }

  return NextResponse.json({ order: updated });
}
