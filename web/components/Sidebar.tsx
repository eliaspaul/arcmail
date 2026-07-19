"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDisconnect, useAccount } from "wagmi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const navItems = [
  { label: "Inbox", icon: "📥", href: "/dashboard/inbox" },
  { label: "Sent", icon: "📤", href: "/dashboard/sent" },
  { label: "Archived", icon: "🗃️", href: "/dashboard/archived" },
  { label: "Deleted", icon: "🗑️", href: "/dashboard/deleted" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { disconnect } = useDisconnect();
  const { address } = useAccount();
  const [alias, setAlias] = useState("");

  useEffect(() => {
    if (!address) return;
    fetch(API_URL + "/api/alias/by-address/" + address)
      .then(r => r.json())
      .then(data => { if (data.alias) setAlias(data.alias); })
      .catch(() => {});
  }, [address]);

  return (
    <aside className="w-64 min-h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
        <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">A</span>
        </div>
        <span className="font-semibold text-base tracking-tight">ArcMail</span>
      </div>

      <div className="px-4 py-4">
        <Link
          href="/dashboard/compose"
          className="flex items-center gap-3 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition w-full"
        >
          <span className="text-lg">✏️</span>
          Compose
        </Link>
      </div>

      <nav className="flex-1 px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={"flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium mb-1 transition " +
              (pathname === item.href ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100")}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
            {address?.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {alias || (address?.slice(0,6) + "..." + address?.slice(-4))}
            </p>
            <p className="text-xs text-gray-400">{alias ? "Arc Testnet" : "No alias set"}</p>
          </div>
        </div>
        <button
          onClick={() => disconnect()}
          className="w-full text-xs text-gray-500 hover:text-black transition text-left"
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}