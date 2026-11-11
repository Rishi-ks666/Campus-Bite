import { NextResponse } from "next/server";
import { CURRENT_STUDENT_ID, formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("student_id, name, balance")
    .eq("student_id", CURRENT_STUDENT_ID)
    .maybeSingle();
  if (walletError) {
    console.error("[GET /api/me] wallet", walletError.message);
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }
  if (!wallet) {
    return NextResponse.json({ error: "Wallet not found for the current student." }, { status: 404 });
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, total, created_at, pickup_slot:pickup_slots(slot_time), order_items(menu_item:menu_items(name))")
    .eq("student_id", CURRENT_STUDENT_ID)
    .order("created_at", { ascending: false })
    .limit(5);
  if (ordersError) {
    console.error("[GET /api/me] orders", ordersError.message);
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const formattedOrders = orders.map((order) => {
    const pickup = Array.isArray(order.pickup_slot) ? order.pickup_slot[0] : order.pickup_slot;
    const itemNames = order.order_items.flatMap((item) => {
      const menuItem = Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item;
      return menuItem ? [menuItem.name] : [];
    });

    return {
      id: order.id,
      status: order.status,
      total: order.total,
      created_at: order.created_at,
      pickup_time: pickup ? formatSlot(pickup.slot_time) : null,
      item_names: itemNames,
    };
  });

  return NextResponse.json({ wallet, orders: formattedOrders });
}
