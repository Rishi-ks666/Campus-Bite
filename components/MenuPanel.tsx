"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  id: number;
  name: string;
  category: "meal" | "snack" | "drink" | "sweet";
  price: number;
  is_veg: boolean;
  stock: number;
  description: string;
};

const categories: { id: MenuItem["category"]; label: string }[] = [
  { id: "meal", label: "Meals" },
  { id: "snack", label: "Snacks" },
  { id: "sweet", label: "Sweets" },
  { id: "drink", label: "Drinks" },
];

export default function MenuPanel({ refreshKey }: { refreshKey: number }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/menu", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load today's menu.");
        setMenu(data.menu);
        setError("");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load today's menu.");
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="font-semibold">Today&apos;s menu</h2>
        <p className="mt-1 text-xs text-slate-500">Availability updates automatically</p>
      </div>
      {error && <p className="m-4 break-words rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!error && menu.length === 0 && <p className="p-5 text-sm text-slate-500">Loading today&apos;s menu…</p>}
      <div className="divide-y divide-slate-100">
        {categories.map(({ id, label }) => {
          const items = menu.filter((item) => item.category === id);
          if (items.length === 0) return null;

          return (
            <div key={id} className="px-4 py-3 sm:px-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        aria-label={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                        title={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          item.is_veg ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{item.name}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-500">{item.description}</p>
                        {item.stock === 0 ? (
                          <span className="mt-1 inline-block rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                            Sold out
                          </span>
                        ) : item.stock <= 3 ? (
                          <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Only {item.stock} left
                          </span>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">{item.stock} available</p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">Rs {item.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
