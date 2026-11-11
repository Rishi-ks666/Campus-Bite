import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import { CURRENT_STUDENT_ID, formatSlot } from "../campusbite";
import { todayInIndia } from "../dates";

type OrderItemInput = { menu_item_id: number; quantity: number };

async function checkDailyOrderLimit(items: OrderItemInput[]): Promise<void> {
  const today = todayInIndia();
  const [year, month, day] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  const startOfToday = new Date(`${today}T00:00:00+05:30`).toISOString();
  const startOfTomorrow = new Date(`${tomorrow}T00:00:00+05:30`).toISOString();
  const supabase = getSupabase();

  const [ordersResult, menuResult] = await Promise.all([
    supabase
      .from("orders")
      .select("total")
      .eq("student_id", CURRENT_STUDENT_ID)
      .neq("status", "cancelled")
      .gte("created_at", startOfToday)
      .lt("created_at", startOfTomorrow),
    supabase
      .from("menu_items")
      .select("id, price")
      .in("id", [...new Set(items.map((item) => item.menu_item_id))]),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (menuResult.error) throw new Error(menuResult.error.message);

  const prices = new Map(menuResult.data.map((item) => [item.id, item.price]));
  const newOrderTotal = items.reduce((total, item) => {
    const price = prices.get(item.menu_item_id);
    if (price === undefined) throw new Error(`Menu item ${item.menu_item_id} not found.`);
    return total + price * item.quantity;
  }, 0);
  const spentToday = ordersResult.data.reduce((total, order) => total + order.total, 0);
  const remaining = Math.max(0, 200 - spentToday);

  if (spentToday + newOrderTotal > 200) {
    throw new Error(`Daily limit of Rs 200 reached. You have Rs ${remaining} left to spend today.`);
  }
}

const getMenu = defineTool({
  name: "getMenu",
  description: "Use this when the student asks what food is available or wants menu recommendations.",
  schema: z.object({
    category: z.enum(["meal", "snack", "drink", "sweet"]).optional().describe("Menu category to filter by"),
    veg_only: z.boolean().optional().describe("Whether to show vegetarian items only"),
    max_price: z.number().int().nonnegative().optional().describe("Maximum item price in rupees"),
  }),
  run: async ({ category, veg_only, max_price }) => {
    const supabase = getSupabase();
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("veg_only")
      .eq("student_id", CURRENT_STUDENT_ID)
      .maybeSingle();
    if (walletError) throw new Error(walletError.message);
    if (!wallet) throw new Error("Wallet not found for the current student.");

    let query = supabase
      .from("menu_items")
      .select("id, name, category, price, is_veg, stock, description")
      .gt("stock", 0)
      .order("category")
      .order("price");
    if (category) query = query.eq("category", category);
    if (wallet.veg_only || veg_only) query = query.eq("is_veg", true);
    if (max_price !== undefined) query = query.lte("price", max_price);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { items: data };
  },
});

const getWalletBalance = defineTool({
  name: "getWalletBalance",
  description: "Use this when the student asks about their wallet or before checking what they can afford.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("wallets")
      .select("name, balance, veg_only")
      .eq("student_id", CURRENT_STUDENT_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Wallet not found for the current student.");
    return data;
  },
});

const setVegOnly = defineTool({
  name: "setVegOnly",
  description: "Use this when the student asks to turn their vegetarian-only menu preference on or off.",
  writes: true,
  schema: z.object({
    veg_only: z.boolean().describe("Whether to show vegetarian menu items only"),
  }),
  run: async ({ veg_only }) => {
    const { data, error } = await getSupabase()
      .from("wallets")
      .update({ veg_only })
      .eq("student_id", CURRENT_STUDENT_ID)
      .select("name, veg_only")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Wallet not found for the current student.");
    return data;
  },
});

const getPickupSlots = defineTool({
  name: "getPickupSlots",
  description: "Use this when the student asks about pickup times or before choosing a pickup time.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("pickup_slots")
      .select("id, slot_time, capacity, booked")
      .order("slot_time");
    if (error) throw new Error(error.message);
    return {
      slots: data
        .map((slot) => ({
          slot_id: slot.id,
          time: formatSlot(slot.slot_time),
          free: slot.capacity - slot.booked,
        }))
        .filter((slot) => slot.free > 0),
    };
  },
});

const getMyOrders = defineTool({
  name: "getMyOrders",
  description: "Use this when the student asks about their recent orders or their order status.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("id, status, total, pickup_slot:pickup_slots(slot_time), order_items(menu_item:menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    return {
      orders: data.map((order) => {
        const pickup = Array.isArray(order.pickup_slot) ? order.pickup_slot[0] : order.pickup_slot;
        const itemNames = order.order_items.flatMap((item) => {
          const menuItem = Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item;
          return menuItem ? [menuItem.name] : [];
        });

        return {
          id: order.id,
          status: order.status,
          total: order.total,
          pickup_time: pickup ? formatSlot(pickup.slot_time) : null,
          item_names: itemNames,
        };
      }),
    };
  },
});

const placeOrder = defineTool({
  name: "placeOrder",
  description: "Use this when the student wants to place an order after selecting items and a pickup slot.",
  writes: true,
  schema: z.object({
    items: z
      .array(
        z.object({
          menu_item_id: z.number().int().positive().describe("ID of a menu item"),
          quantity: z.number().int().min(1).max(5).describe("Quantity to order, from 1 to 5"),
        })
      )
      .min(1)
      .describe("At least one menu item and its quantity"),
    slot_id: z.number().int().positive().describe("ID of the selected pickup slot"),
  }),
  run: async ({ items, slot_id }) => {
    await checkDailyOrderLimit(items);
    const { data, error } = await getSupabase().rpc("place_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_slot_id: slot_id,
      p_items: items,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const cancelOrder = defineTool({
  name: "cancelOrder",
  description: "Use this when the student asks to cancel one of their orders.",
  writes: true,
  schema: z.object({
    order_id: z.number().int().positive().describe("ID of the student's order to cancel"),
  }),
  run: async ({ order_id }) => {
    const { data, error } = await getSupabase().rpc("cancel_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_order_id: order_id,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const reorderLast = defineTool({
  name: "reorderLast",
  description: "Use this when the student asks to order the same as last time.",
  writes: true,
  schema: z.object({}),
  run: async () => {
    const supabase = getSupabase();
    const { data: previousOrder, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("student_id", CURRENT_STUDENT_ID)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!previousOrder) throw new Error("You do not have a previous order to repeat.");

    const { data: previousItems, error: itemsError } = await supabase
      .from("order_items")
      .select("menu_item_id, quantity")
      .eq("order_id", previousOrder.id);
    if (itemsError) throw new Error(itemsError.message);
    if (previousItems.length === 0) throw new Error("Your latest order has no items to repeat.");

    await checkDailyOrderLimit(previousItems);

    const { data: slots, error: slotsError } = await supabase
      .from("pickup_slots")
      .select("id, capacity, booked")
      .order("slot_time");
    if (slotsError) throw new Error(slotsError.message);
    const earliestFreeSlot = slots.find((slot) => slot.booked < slot.capacity);
    if (!earliestFreeSlot) throw new Error("There are no free pickup slots available.");

    const { data, error } = await supabase.rpc("place_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_slot_id: earliestFreeSlot.id,
      p_items: previousItems,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

export const tools: AgentTool[] = [
  getMenu,
  getWalletBalance,
  setVegOnly,
  getPickupSlots,
  getMyOrders,
  placeOrder,
  cancelOrder,
  reorderLast,
];
