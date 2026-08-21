"use client";

import { useState } from "react";
import VolumeProfilePanel from "./VolumeProfilePanel";
import OrderFlowPanel from "./OrderFlowPanel";
import LiquidationHeatmap from "./LiquidationHeatmap";
import { BarChart2, Activity, Flame, X } from "lucide-react";

interface Props {
  timeframe: string;
  exchange?: string;
  isOpen: boolean;
  onClose: () => void;
}

type AnalyticsTab = 'volume-profile' | 'order-flow' | 'liquidations';

export default function AdvancedAnalyticsPanel({ 
  timeframe, 
  exchange = 'binance',
  isOpen,
  onClose 
}: Props) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('volume-profile');

  if (!isOpen) return null;

  const tabs = [
    { id: 'volume-profile', label: 'Volume Profile', icon: BarChart2 },
    { id: 'order-flow', label: 'Order Flow', icon: Activity },
    { id: 'liquidations', label: 'Liquidations', icon: Flame },
  ] as const;

  return (
    <div className="fixed right-4 top-20 bottom-20 w-80 bg-bg-surface border border-t-border rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bb-thin bg-bg-l1">
        <h2 className="t-body font-semibold text-text-main">Advanced Analytics</h2>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-text-main transition-colors"
          aria-label="Close analytics panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bb-thin bg-bg-l1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 transition-colors ${
              activeTab === id
                ? 'text-primary border-b-2 border-primary bg-bg-l2'
                : 'text-text-dim hover:text-text-main hover:bg-bg-l2'
            }`}
          >
            <Icon size={14} />
            <span className="t-label-caps">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'volume-profile' && (
          <VolumeProfilePanel timeframe={timeframe} exchange={exchange} />
        )}
        {activeTab === 'order-flow' && (
          <OrderFlowPanel timeframe={timeframe} exchange={exchange} />
        )}
        {activeTab === 'liquidations' && (
          <LiquidationHeatmap timeframe={timeframe} exchange={exchange} />
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bt-thin bg-bg-l1">
        <div className="t-body-xs text-text-dim text-center">
          Real-time data from {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
        </div>
      </div>
    </div>
  );
}
