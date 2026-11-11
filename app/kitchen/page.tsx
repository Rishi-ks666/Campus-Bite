"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type KitchenOrder = {
  id: number;
  status: "placed" | "preparing" | "ready";
  total: number;
  student_name: string | null;
  pickup_time: string | null;
  items: { name: string; quantity: number }[];
};

type MenuStockItem = {
  id: number;
  name: string;
  category: string;
  stock: number;
};

const columns: {
  status: KitchenOrder["status"];
  title: string;
  action: string;
  nextStatus: "preparing" | "ready" | "collected";
  accent: string;
}[] = [
  {
    status: "placed",
    title: "New orders",
    action: "Start preparing",
    nextStatus: "preparing",
    accent: "border-amber-400",
  },
  {
    status: "preparing",
    title: "Preparing",
    action: "Mark ready",
    nextStatus: "ready",
    accent: "border-sky-400",
  },
  {
    status: "ready",
    title: "Ready for pickup",
    action: "Collected",
    nextStatus: "collected",
    accent: "border-emerald-400",
  },
];

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [menuItems, setMenuItems] = useState<MenuStockItem[]>([]);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [busyMenuItem, setBusyMenuItem] = useState<number | null>(null);
  const [stockError, setStockError] = useState("");

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/kitchen", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load kitchen orders.");
      setOrders(data.orders);
      setError("");
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Could not load kitchen orders.");
    }
  }, []);

  const loadMenuStock = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/menu", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load menu stock.");
      setMenuItems(data.menu);
      setStockError("");
    } catch (err) {
      if (signal?.aborted) return;
      setStockError(err instanceof Error ? err.message : "Could not load menu stock.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);
    void loadMenuStock(controller.signal);
    const interval = window.setInterval(() => void loadOrders(controller.signal), 3000);
    const stockInterval = window.setInterval(() => void loadMenuStock(controller.signal), 5000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.clearInterval(stockInterval);
    };
  }, [loadMenuStock, loadOrders]);

  async function advanceOrder(order: KitchenOrder, status: "preparing" | "ready" | "collected") {
    setBusyOrder(order.id);
    setError("");
    try {
      const response = await fetch("/api/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update order status.");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order status.");
      await loadOrders();
    } finally {
      setBusyOrder(null);
    }
  }

  async function markSoldOut(item: MenuStockItem) {
    setBusyMenuItem(item.id);
    setStockError("");
    try {
      const response = await fetch("/api/kitchen/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_item_id: item.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update menu stock.");
      await loadMenuStock();
    } catch (err) {
      setStockError(err instanceof Error ? err.message : "Could not update menu stock.");
    } finally {
      setBusyMenuItem(null);
    }
  }

  return (
    <main className="min-h-screen w-full min-w-0 bg-slate-950 px-3 py-5 text-white sm:px-4 md:px-8 md:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center py-2 text-sm text-slate-400 hover:text-white">
            ← CampusBite
          </Link>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight">Kitchen orders</h1>
          <p className="mt-1 text-sm text-slate-400">SRM canteen · Live order queue</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </header>

      {error && (
        <div role="alert" className="mb-5 break-words rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid min-w-0 items-start gap-5 md:grid-cols-3">
        {columns.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="min-w-0">
              <div className={`mb-3 flex items-center justify-between border-l-2 ${column.accent} pl-3`}>
                <h2 className="font-semibold">{column.title}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                  {columnOrders.length}
                </span>
              </div>

              <div className="space-y-3">
                {columnOrders.map((order) => (
                  <article key={order.id} className="min-w-0 rounded-xl border border-white/10 bg-slate-900 p-4 shadow-lg">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold">Order #{order.id}</h3>
                        <p className="mt-0.5 break-words text-sm text-slate-400">{order.student_name ?? "Student"}</p>
                      </div>
                      <span className="max-w-full break-words rounded-lg bg-white/5 px-2 py-1 text-sm font-medium">
                        {order.pickup_time ?? "Pickup time unavailable"}
                      </span>
                    </div>

                    <ul className="my-4 space-y-1.5 border-y border-white/10 py-3 text-sm text-slate-200">
                      {order.items.length > 0 ? (
                        order.items.map((item, index) => (
                          <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                            <span className="min-w-0 break-words">{item.name}</span>
                            <span className="shrink-0 text-slate-400">× {item.quantity}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-400">Items unavailable</li>
                      )}
                    </ul>

                    <div className="mb-3 flex justify-between text-sm">
                      <span className="text-slate-400">Total</span>
                      <span className="font-semibold">Rs {order.total}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void advanceOrder(order, column.nextStatus)}
                      disabled={busyOrder === order.id}
                      className="min-h-11 w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      {busyOrder === order.id ? "Updating…" : column.action}
                    </button>
                  </article>
                ))}
                {columnOrders.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                    No orders
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Menu stock</h2>
            <p className="mt-0.5 text-xs text-slate-400">Mark an item sold out to hide it from ordering.</p>
          </div>
          <span className="text-xs text-slate-400">Refreshes every 5 seconds</span>
        </div>
        {stockError && (
          <p role="alert" className="m-4 break-words rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
            {stockError}
          </p>
        )}
        {!stockError && menuItems.length === 0 && (
          <p className="px-4 py-5 text-sm text-slate-400">Loading menu stock…</p>
        )}
        {menuItems.length > 0 && (
          <ul className="divide-y divide-white/5 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-x-6 sm:px-4">
            {menuItems.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-0">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{item.name}</p>
                  <p className="text-xs capitalize text-slate-400">
                    {item.category} · {item.stock} in stock
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void markSoldOut(item)}
                  disabled={item.stock === 0 || busyMenuItem === item.id}
                  className="min-h-11 shrink-0 rounded-lg border border-rose-300/20 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {item.stock === 0 ? "Sold out" : busyMenuItem === item.id ? "Updating…" : "Mark sold out"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
