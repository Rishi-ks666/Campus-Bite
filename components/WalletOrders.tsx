"use client";

import { useEffect, useState } from "react";

type Wallet = { student_id: string; name: string; balance: number };
type StudentOrder = {
  id: number;
  status: string;
  total: number;
  pickup_time: string | null;
  item_names: string[];
};

const statusStyles: Record<string, string> = {
  placed: "bg-amber-400/15 text-amber-200",
  preparing: "bg-sky-400/15 text-sky-200",
  ready: "bg-emerald-400/15 text-emerald-200",
  collected: "bg-slate-400/15 text-slate-300",
  cancelled: "bg-rose-400/15 text-rose-200",
};

export default function WalletOrders({ refreshKey }: { refreshKey: number }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<StudentOrder[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/me", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load your wallet and orders.");
        setWallet(data.wallet);
        setOrders(data.orders);
        setError("");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load your wallet and orders.");
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <p className="text-sm text-slate-400">CampusBite wallet</p>
        {wallet ? (
          <div className="mt-1 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <h2 className="min-w-0 break-words text-lg font-semibold">{wallet.name}</h2>
            <p className="shrink-0 text-xl font-semibold text-emerald-300">Rs {wallet.balance}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Loading wallet…</p>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5">
        <h3 className="mb-3 font-semibold">My orders today</h3>
        {error && <p className="mb-3 break-words rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
        {!error && orders.length === 0 && (
          <p className="text-sm text-slate-400">No orders yet. Ask CampusBite to find you something good.</p>
        )}
        {orders.length > 0 && (
          <ul className="divide-y divide-white/10">
            {orders.map((order) => (
              <li key={order.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Order #{order.id}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                      statusStyles[order.status] ?? "bg-white/10 text-slate-200"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm text-slate-300">
                  {order.item_names.length > 0 ? order.item_names.join(", ") : "Items unavailable"}
                </p>
                <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>Pickup {order.pickup_time ?? "time unavailable"}</span>
                  <span className="shrink-0">Rs {order.total}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
