"use client";

import { useEffect, useState } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { cachedApi } from "@/lib/cache/cachedApi";
import { calculateOrderFlow, OrderFlowData } from "@/lib/analytics/volumeProfile";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface Props {
  timeframe: string;
  exchange?: string;
}

export default function OrderFlowPanel({ timeframe, exchange = 'binance' }: Props) {
  const { market } = useMarket();
  const [orderFlow, setOrderFlow] = useState<OrderFlowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!market) return;

    const loadOrderFlow = async () => {
      setIsLoading(true);
      const candles = await cachedApi.fetchKlines(market.symbol, timeframe, 100, exchange as any);
      if (candles.length > 0) {
        const flow = calculateOrderFlow(candles);
        setOrderFlow(flow);
      }
      setIsLoading(false);
    };

    loadOrderFlow();
  }, [market?.symbol, timeframe, exchange]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-l1">
        <span className="t-body-sm text-text-dim">Loading Order Flow...</span>
      </div>
    );
  }

  if (orderFlow.length === 0) return null;

  const latest = orderFlow[orderFlow.length - 1];
  const deltaChange = orderFlow.length > 1 
    ? latest.cumulativeDelta - orderFlow[orderFlow.length - 2].cumulativeDelta 
    : 0;
  const recentFlow = orderFlow.slice(-10);

  return (
    <div className="h-full flex flex-col bg-bg-l1 p-3 overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-primary" />
        <h3 className="t-body font-medium text-text-main">Order Flow</h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-bg-l2 rounded p-2">
          <div className="t-label-caps text-text-dim mb-1">Cumulative Delta</div>
          <div className={`t-data-sm font-medium ${
            latest.cumulativeDelta >= 0 ? 'text-long' : 'text-short'
          }`}>
            {latest.cumulativeDelta >= 0 ? '+' : ''}{latest.cumulativeDelta.toFixed(0)}
          </div>
        </div>

        <div className="bg-bg-l2 rounded p-2">
          <div className="t-label-caps text-text-dim mb-1">Delta Change</div>
          <div className={`t-data-sm font-medium ${
            deltaChange >= 0 ? 'text-long' : 'text-short'
          }`}>
            {deltaChange >= 0 ? '+' : ''}{deltaChange.toFixed(0)}
          </div>
        </div>

        <div className="bg-bg-l2 rounded p-2">
          <div className="t-label-caps text-text-dim mb-1">Buy Volume</div>
          <div className="t-data-sm text-long">
            {latest.buyVolume.toFixed(2)}
          </div>
        </div>

        <div className="bg-bg-l2 rounded p-2">
          <div className="t-label-caps text-text-dim mb-1">Sell Volume</div>
          <div className="t-data-sm text-short">
            {latest.sellVolume.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Recent Flow */}
      <div className="flex-1">
        <div className="t-label-caps text-text-dim mb-2">Recent Flow</div>
        <div className="space-y-1">
          {recentFlow.reverse().map((flow, idx) => {
            const date = new Date(flow.time * 1000);
            const timeStr = date.toLocaleTimeString(undefined, { 
              hour: '2-digit', 
              minute: '2-digit' 
            });

            return (
              <div
                key={idx}
                className="flex items-center justify-between bg-bg-l2 rounded px-2 py-1.5 hover:bg-bg-l3 transition-colors"
              >
                <span className="t-body-xs text-text-dim">{timeStr}</span>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-long" />
                    <span className="t-data-xs text-long">{flow.buyVolume.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown size={12} className="text-short" />
                    <span className="t-data-xs text-short">{flow.sellVolume.toFixed(1)}</span>
                  </div>
                </div>

                <div className={`t-data-xs font-medium ${
                  flow.delta >= 0 ? 'text-long' : 'text-short'
                }`}>
                  {flow.delta >= 0 ? '+' : ''}{flow.delta.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delta Indicator */}
      <div className="mt-3 pt-3 bt-thin">
        <div className="t-label-caps text-text-dim mb-2">Delta Momentum</div>
        <div className="relative h-2 bg-bg-l3 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-1/2 h-full bg-gradient-to-r from-short to-long transition-all duration-300"
            style={{
              width: `${Math.min(Math.abs(latest.cumulativeDelta / 1000) * 50, 50)}%`,
              transform: latest.cumulativeDelta >= 0 ? 'translateX(0)' : 'translateX(-100%)'
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="t-body-xs text-short">Sell Pressure</span>
          <span className="t-body-xs text-long">Buy Pressure</span>
        </div>
      </div>
    </div>
  );
}
