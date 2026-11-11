"use client";

import { useState } from "react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";
import MenuPanel from "@/components/MenuPanel";
import WalletOrders from "@/components/WalletOrders";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 p-3 sm:p-4 md:p-6">
      <header className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">CampusBite · SRM canteen ordering agent</h1>
          <p className="text-sm text-slate-500">Your canteen, ready when you are.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/kitchen"
            className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Open kitchen screen
          </Link>
          <button onClick={logout} className="inline-flex min-h-11 items-center py-2 text-sm text-slate-500 hover:text-slate-900">
            Log out
          </button>
        </div>
      </header>
      <div className="grid min-w-0 gap-4 md:grid-cols-5">
        <section className="min-w-0 md:col-span-3">
          <AgentChat onDataChanged={() => setRefreshKey((k) => k + 1)} />
        </section>
        <section className="min-w-0 md:col-span-2">
          <div className="space-y-4">
            <WalletOrders refreshKey={refreshKey} />
            <MenuPanel refreshKey={refreshKey} />
          </div>
        </section>
      </div>
    </main>
  );
}
