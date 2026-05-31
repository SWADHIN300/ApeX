"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
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

interface SideNavProps {
  isOpen: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function SideNav({ isOpen, isExpanded, onToggleExpand }: SideNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-14 z-40 h-[calc(100vh-56px)] flex flex-col bg-bg-surface br-thin transition-[transform,width] duration-300 overflow-hidden ${
        isOpen
          ? isExpanded
            ? "w-52 translate-x-0"
            : "w-16 translate-x-0"
          : "w-0 -translate-x-full"
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
              className={`flex h-11 w-full items-center gap-4 px-3 cursor-pointer transition-all ${
                isActive
                  ? "bg-primary-ctr text-white border-l-2 border-primary"
                  : "text-text-muted hover:bg-bg-l3 border-l-2 border-transparent"
              } no-underline`}
            >
              <Icon size={18} className="shrink-0" />
              <span
                className={`t-label-caps whitespace-nowrap transition-all duration-300 ${
                  isExpanded
                    ? "w-auto opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Deposit (visible when expanded) */}
      <div
        className={`mt-auto p-4 bt-thin transition-opacity duration-300 ${
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Link href="/accounts" className="block w-full text-center py-2 bg-long text-white t-label-caps hover:opacity-90 no-underline">
          Deposit Funds
        </Link>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col gap-2 p-2 bt-thin">
        {bottomItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex h-11 w-full items-center gap-4 px-3 text-text-muted hover:bg-bg-l3 cursor-pointer transition-all border-l-2 border-transparent no-underline"
            >
              <Icon size={18} className="shrink-0" />
              <span
                className={`t-label-caps whitespace-nowrap transition-all duration-300 ${
                  isExpanded
                    ? "w-auto opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Expand / Collapse toggle button */}
        <button
          onClick={onToggleExpand}
          className="flex h-11 w-full items-center gap-4 px-3 text-text-muted hover:bg-bg-l3 cursor-pointer transition-all border-l-2 border-transparent bt-thin mt-1"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <ChevronLeft size={18} className="shrink-0" />
          ) : (
            <ChevronRight size={18} className="shrink-0" />
          )}
          <span
            className={`t-label-caps whitespace-nowrap transition-all duration-300 ${
              isExpanded
                ? "w-auto opacity-100"
                : "w-0 overflow-hidden opacity-0"
            }`}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}
