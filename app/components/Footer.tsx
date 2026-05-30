"use client";

export default function Footer() {
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant flex justify-between items-center w-full px-gutter py-2 h-11 shrink-0">
      <div className="flex gap-8 overflow-x-auto">
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">My Collateral</span>
          <span className="text-value-sm">$5,000.00</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Total PnL</span>
          <span className="text-value-sm text-secondary">+$437.80</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Margin Ratio</span>
          <span className="text-value-sm">12%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Liquidation Risk</span>
          <span className="text-value-sm text-on-surface">Low</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse-dot" />
          <span className="text-[11px] font-bold text-secondary uppercase">
            Keeper Bot: Active
          </span>
        </div>
        <span className="text-label-sm text-outline">© 2025 ApeX</span>
      </div>
    </footer>
  );
}
