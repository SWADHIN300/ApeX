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
  Repeat2,
  Settings,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const mainItems: NavItem[] = [
  { icon: ArrowUpDown, label: "Trade",    href: "/trade"   },
  { icon: Repeat2,    label: "Swap",     href: "/swap"    },
  { icon: TrendingUp, label: "Markets",  href: "/markets" },
  { icon: History,    label: "History",  href: "/history" },
  { icon: Gift,       label: "Rewards",  href: "/rewards" },
  { icon: User,       label: "Account",  href: "/accounts"},
];

const bottomItems: NavItem[] = [
  { icon: Settings,   label: "Settings", href: "/settings" },
  { icon: CircleHelp, label: "Support",  href: "/settings" },
];

interface SideNavProps {
  isOpen: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function SideNav({ isOpen, isExpanded, onToggleExpand }: SideNavProps) {
  const pathname = usePathname();

  const tooltipClass = `pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap
    border border-t-border bg-bg-l2 px-3 py-1.5 t-label-caps text-text-main shadow-xl
    opacity-0 transition-opacity duration-150 rounded-sm
    group-hover:opacity-100 group-focus-visible:opacity-100 ${isExpanded ? "hidden" : ""}`;

  return (
    <aside
      className={`fixed left-0 top-14 z-40 h-[calc(100vh-56px)] flex flex-col bg-bg-surface br-thin transition-[transform,width] duration-300 ${
        isOpen
          ? isExpanded
            ? "w-52 translate-x-0"
            : "w-16 translate-x-0"
          : "w-0 -translate-x-full"
      }`}
      style={{ background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)" }}
    >
      {/* Main nav */}
      <div className="flex flex-col gap-1 p-2 mt-2">
        {mainItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={`group relative flex h-10 w-full items-center gap-3.5 px-3 cursor-pointer
                transition-all duration-200 focus-visible:outline-none focus-visible:ring-1
                focus-visible:ring-primary no-underline
                ${isActive
                  ? "nav-item-active"
                  : "text-text-muted hover:text-text-main border-l-2 border-transparent"
                }`}
              style={!isActive ? {
                transition: "background 0.2s, color 0.2s",
              } : undefined}
              onMouseEnter={!isActive ? (e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "linear-gradient(90deg, rgba(124,111,255,0.08) 0%, transparent 100%)";
              } : undefined}
              onMouseLeave={!isActive ? (e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              } : undefined}
            >
              <Icon
                size={17}
                className="shrink-0"
                style={isActive ? {
                  filter: "drop-shadow(0 0 5px var(--primary))",
                  color: "var(--primary)",
                } : undefined}
              />
              <span
                className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  isExpanded
                    ? "w-auto opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                {item.label}
              </span>
              <span className={tooltipClass}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Deposit button (visible when expanded) */}
      <div
        className={`mt-auto p-3 bt-thin transition-all duration-300 ${
          isExpanded ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none translate-y-2"
        }`}
      >
        <Link
          href="/accounts"
          className="flex items-center justify-center gap-2 w-full py-2.5 btn-long text-white no-underline"
          style={{ borderRadius: "4px" }}
        >
          <Wallet size={14} />
          <span className="t-label-caps">Deposit Funds</span>
        </Link>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col gap-1 p-2 bt-thin">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className="group relative flex h-10 w-full items-center gap-3.5 px-3 text-text-muted
                hover:text-text-main cursor-pointer transition-all duration-200 border-l-2
                border-transparent no-underline focus-visible:outline-none focus-visible:ring-1
                focus-visible:ring-primary"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "linear-gradient(90deg, rgba(124,111,255,0.07) 0%, transparent 100%)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon size={17} className="shrink-0" />
              <span
                className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  isExpanded
                    ? "w-auto opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                {item.label}
              </span>
              <span className={tooltipClass}>{item.label}</span>
            </Link>
          );
        })}

        {/* Expand / Collapse toggle */}
        <button
          onClick={onToggleExpand}
          className="group relative flex h-10 w-full items-center gap-3.5 px-3 text-text-dim
            hover:text-text-muted cursor-pointer transition-all duration-200 border-l-2
            border-transparent bt-thin mt-1 focus-visible:outline-none focus-visible:ring-1
            focus-visible:ring-primary"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "linear-gradient(90deg, rgba(124,111,255,0.05) 0%, transparent 100%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {isExpanded ? (
            <ChevronLeft size={17} className="shrink-0" />
          ) : (
            <ChevronRight size={17} className="shrink-0" />
          )}
          <span
            className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              isExpanded
                ? "w-auto opacity-100"
                : "w-0 overflow-hidden opacity-0"
            }`}
            style={{ letterSpacing: "-0.01em" }}
          >
            Collapse
          </span>
          <span className={tooltipClass}>
            {isExpanded ? "Collapse" : "Expand"}
          </span>
        </button>
      </div>
    </aside>
  );
}
