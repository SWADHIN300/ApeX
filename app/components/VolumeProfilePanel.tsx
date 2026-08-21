"use client";

import { useEffect, useState, useRef } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { cachedApi } from "@/lib/cache/cachedApi";
import { calculateVolumeProfile, VolumeProfileData } from "@/lib/analytics/volumeProfile";
import { BarChart2 } from "lucide-react";

interface Props {
  timeframe: string;
  exchange?: string;
}

export default function VolumeProfilePanel({ timeframe, exchange = 'binance' }: Props) {
  const { market } = useMarket();
  const [volumeProfile, setVolumeProfile] = useState<VolumeProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!market) return;

    const loadVolumeProfile = async () => {
      setIsLoading(true);
      const candles = await cachedApi.fetchKlines(market.symbol, timeframe, 500, exchange as any);
      if (candles.length > 0) {
        const profile = calculateVolumeProfile(candles, 50);
        setVolumeProfile(profile);
      }
      setIsLoading(false);
    };

    loadVolumeProfile();
  }, [market?.symbol, timeframe, exchange]);

  useEffect(() => {
    if (!volumeProfile || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw volume profile
    const maxVolume = Math.max(...volumeProfile.levels.map(l => l.volume));
    const priceRange = volumeProfile.levels[volumeProfile.levels.length - 1].price - volumeProfile.levels[0].price;
    const barHeight = height / volumeProfile.levels.length;

    volumeProfile.levels.forEach((level, idx) => {
      const barWidth = (level.volume / maxVolume) * (width * 0.8);
      const y = height - (idx * barHeight);

      // Draw bar
      const buyRatio = level.volume > 0 ? level.buyVolume / level.volume : 0;
      
      // Buy volume (green)
      ctx.fillStyle = 'rgba(29, 158, 117, 0.6)';
      ctx.fillRect(0, y - barHeight, barWidth * buyRatio, barHeight);

      // Sell volume (red)
      ctx.fillStyle = 'rgba(216, 90, 48, 0.6)';
      ctx.fillRect(barWidth * buyRatio, y - barHeight, barWidth * (1 - buyRatio), barHeight);

      // Highlight POC
      if (Math.abs(level.price - volumeProfile.poc) < priceRange * 0.01) {
        ctx.strokeStyle = 'rgba(255, 235, 59, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, y - barHeight, barWidth, barHeight);
      }

      // Highlight Value Area
      if (level.price >= volumeProfile.val && level.price <= volumeProfile.vah) {
        ctx.strokeStyle = 'rgba(41, 98, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y - barHeight, width, barHeight);
      }
    });
  }, [volumeProfile]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-l1">
        <span className="t-body-sm text-text-dim">Loading Volume Profile...</span>
      </div>
    );
  }

  if (!volumeProfile) return null;

  return (
    <div className="h-full flex flex-col bg-bg-l1 p-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={16} className="text-primary" />
        <h3 className="t-body font-medium text-text-main">Volume Profile</h3>
      </div>

      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={200}
          height={400}
          className="w-full h-full"
        />
      </div>

      <div className="mt-3 space-y-2 bb-thin pt-3">
        <div className="flex justify-between items-center">
          <span className="t-body-xs text-text-dim">POC (Point of Control):</span>
          <span className="t-data-xs text-text-price">${volumeProfile.poc.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="t-body-xs text-text-dim">Value Area High:</span>
          <span className="t-data-xs text-text-main">${volumeProfile.vah.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="t-body-xs text-text-dim">Value Area Low:</span>
          <span className="t-data-xs text-text-main">${volumeProfile.val.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="t-body-xs text-text-dim">Total Volume:</span>
          <span className="t-data-xs text-text-main">
            {volumeProfile.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 t-body-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-long/60 rounded-sm" />
          <span className="text-text-dim">Buy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-short/60 rounded-sm" />
          <span className="text-text-dim">Sell</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-yellow-500 rounded-sm" />
          <span className="text-text-dim">POC</span>
        </div>
      </div>
    </div>
  );
}
