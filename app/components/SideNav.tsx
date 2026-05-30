"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpDown,
  CircleHelp,
  Gift,
  History,
  Settings,
  TrendingUp,
  User,
} from "lucide-react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const mainItems: NavItem[] = [
  { icon: ArrowUpDown, label: "Trade", href: "/trade" },
  { icon: TrendingUp, label: "Markets", href: "/markets" },
  { icon: History, label: "History", href: "/history" },
  { icon: Gift, label: "Rewards", href: "/rewards" },
  { icon: User, label: "Account", href: "/accounts" },
];

const bottomItems: NavItem[] = [
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: CircleHelp, label: "Support", href: "/settings" },
];

export default function SideNav({ isOpen }: { isOpen: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-14 z-40 h-[calc(100vh-56px)] flex flex-col bg-bg-surface br-thin transition-[transform,width] duration-300 group overflow-hidden ${
        isOpen
          ? "w-16 hover:w-64 translate-x-0"
          : "w-0 hover:w-0 -translate-x-full"
      }`}
    >
      {/* Main nav */}
      <div className="flex flex-col gap-2 p-2 mt-2">
        {mainItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-11 w-full items-center justify-center gap-0 px-0 cursor-pointer transition-all group-hover:justify-start group-hover:gap-4 group-hover:px-3 ${
                isActive
                  ? "bg-primary-ctr text-white border-l-2 border-primary"
                  : "text-text-muted hover:bg-bg-l3 border-l-2 border-transparent"
              } no-underline`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="t-label-caps w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Deposit (visible on expand) */}
      <div className="mt-auto p-4 bt-thin opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="w-full py-2 bg-long text-white t-label-caps hover:opacity-90">
          Deposit Funds
        </button>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col gap-2 p-2 bt-thin">
        {bottomItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex h-11 w-full items-center justify-center gap-0 px-0 text-text-muted hover:bg-bg-l3 cursor-pointer transition-all border-l-2 border-transparent group-hover:justify-start group-hover:gap-4 group-hover:px-3 no-underline"
            >
              <Icon size={18} className="shrink-0" />
              <span className="t-label-caps w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
