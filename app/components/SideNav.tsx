"use client";

interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
}

const mainItems: NavItem[] = [
  { icon: "swap_vert", label: "Trade", active: true },
  { icon: "show_chart", label: "Markets" },
  { icon: "history", label: "History" },
  { icon: "redeem", label: "Rewards" },
  { icon: "person", label: "Account" },
];

const bottomItems: NavItem[] = [
  { icon: "settings", label: "Settings" },
  { icon: "contact_support", label: "Support" },
];

export default function SideNav() {
  return (
    <aside className="fixed left-0 top-14 h-[calc(100vh-56px)] flex flex-col z-40 bg-bg-surface br-thin w-16 hover:w-64 transition-[width] duration-300 group overflow-hidden">
      {/* Main nav */}
      <div className="flex flex-col gap-2 p-2 mt-2">
        {mainItems.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 p-3 cursor-pointer transition-colors ${
              item.active
                ? "bg-primary-ctr text-white border-l-2 border-primary"
                : "text-text-muted hover:bg-bg-l3 border-l-2 border-transparent"
            }`}
          >
            <span className="material-symbols-outlined shrink-0">
              {item.icon}
            </span>
            <span className="t-label-caps opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Deposit (visible on expand) */}
      <div className="mt-auto p-4 bt-thin opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="w-full py-2 bg-long text-white t-label-caps hover:opacity-90">
          Deposit Funds
        </button>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col gap-2 p-2 bt-thin">
        {bottomItems.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 text-text-muted hover:bg-bg-l3 cursor-pointer transition-colors border-l-2 border-transparent"
          >
            <span className="material-symbols-outlined shrink-0">
              {item.icon}
            </span>
            <span className="t-label-caps opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
