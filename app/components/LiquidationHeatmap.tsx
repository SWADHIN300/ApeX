"use client";

import { useEffect, useState } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { cachedApi } from "@/lib/cache/cachedApi";
import { estimateLiquidationLevels, LiquidationLevel } from "@/lib/analytics/volumeProfile";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  timeframe: string;
  exchange?: string;
}

export default function LiquidationHeatmap({ timeframe, exchange = 'binance' }: Props) {
  const { market } = useMarket();
  const [liquidations, setLiquidations] = useState<LiquidationLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!market) return;

    const loadLiquidations = async () => {
      setIsLoading(true);
      const candles = await cachedApi.fetchKlines(market.symbol, timeframe, 200, exchange as any);
      if (candles.length > 0) {
        const levels = estimateLiquidationLevels(candles, 1.5);
        // Sort by liquidation volume and take top 20
        const sorted = levels
          .sort((a, b) => b.liquidationVolume - a.liquidationVolume)
          .slice(0, 20);
        setLiquidations(sorted);
      }
      setIsLoading(false);
    };

    loadLiquidations();
  }, [market?.symbol, timeframe, exchange]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-l1">
        <span className="t-body-sm text-text-dim">Loading Liquidation Data...</span>
      </div>
    );
  }

  if (liquidations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-l1 p-3">
        <span className="t-body-sm text-text-dim text-center">
          No significant liquidation levels detected
        </span>
      </div>
    );
  }

  const maxVolume = Math.max(...liquidations.map(l => l.liquidationVolume));
  const longLiqs = liquidations.filter(l => l.type === 'long');
  const shortLiqs = liquidations.filter(l => l.type === 'short');

  return (
    <div className="h-full flex flex-col bg-bg-l1 p-3 overflow-y-auto">
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} className="text-orange-500" />
        <h3 className="t-body font-medium text-text-main">Liquidation Heatmap</h3>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-short/10 border border-short/30 rounded p-2">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown size={12} className="text-short" />
            <span className="t-label-caps text-short">Long Liquidations</span>
          </div>
          <div className="t-data-sm text-short font-medium">{longLiqs.length}</div>
        </div>

        <div className="bg-long/10 border border-long/30 rounded p-2">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp size={12} className="text-long" />
            <span className="t-label-caps text-long">Short Liquidations</span>
          </div>
          <div className="t-data-sm text-long font-medium">{shortLiqs.length}</div>
        </div>
      </div>

      {/* Liquidation Levels */}
      <div className="flex-1">
        <div className="t-label-caps text-text-dim mb-2">Detected Levels</div>
        <div className="space-y-1.5">
          {liquidations.map((liq, idx) => {
            const intensity = (liq.liquidationVolume / maxVolume) * 100;
            const isLong = liq.type === 'long';

            return (
              <div
                key={idx}
                className={`relative rounded overflow-hidden ${
                  isLong ? 'bg-short/5' : 'bg-long/5'
                }`}
              >
                {/* Background bar */}
                <div
                  className={`absolute inset-0 ${
                    isLong ? 'bg-short/20' : 'bg-long/20'
                  }`}
                  style={{ width: `${intensity}%` }}
                />

                {/* Content */}
                <div className="relative flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {isLong ? (
                      <TrendingDown size={14} className="text-short" />
                    ) : (
                      <TrendingUp size={14} className="text-long" />
                    )}
                    <div>
                      <div className={`t-data-xs font-medium ${
                        isLong ? 'text-short' : 'text-long'
                      }`}>
                        ${liq.price.toFixed(2)}
                      </div>
                      <div className="t-body-xs text-text-dim">
                        {isLong ? 'Long' : 'Short'} Liq
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="t-data-xs text-text-main">
                      {liq.liquidationVolume.toLocaleString(undefined, { 
                        maximumFractionDigits: 0 
                      })}
                    </div>
                    <div className="t-body-xs text-text-dim">Volume</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 bt-thin">
        <div className="t-body-xs text-text-dim">
          Liquidation levels estimated from high-volume price wicks. 
          Higher intensity indicates potential liquidation clusters.
        </div>
      </div>
    </div>
  );
}
