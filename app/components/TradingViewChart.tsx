"use client";

import { useEffect, useRef, useState } from "react";
import { createApexDatafeed } from "@/lib/tradingViewDatafeed";
import { resolutionToTimeframe } from "@/lib/udf";

/**
 * TradingView Advanced Charts, fed by ApeX's own on-chain candles.
 *
 * Advanced Charts is free but access-restricted: TradingView grants the library
 * on request and it is not published to npm, so it cannot be bundled here.
 * Drop the library into `public/charting_library/` and this component picks it
 * up automatically; until then `onUnavailable` fires so the caller can render
 * the bundled lightweight-charts view instead.
 *
 * See public/charting_library/README.md for setup.
 */

const LIBRARY_SRC = "/charting_library/charting_library.standalone.js";

type Props = {
  symbol: string;
  /** UDF resolution, e.g. "15" or "1D". */
  resolution?: string;
  /** Called when the licensed library isn't installed, so a fallback can render. */
  onUnavailable?: () => void;
};

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => { remove?: () => void };
    };
  }
}

/** Loads the standalone bundle once, resolving false when it isn't installed. */
function loadLibrary(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.TradingView?.widget) return Promise.resolve(true);

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${LIBRARY_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(Boolean(window.TradingView?.widget)));
      existing.addEventListener("error", () => resolve(false));
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = LIBRARY_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.TradingView?.widget));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function TradingViewChart({
  symbol,
  resolution = "15",
  onUnavailable,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;

    void loadLibrary().then((available) => {
      if (cancelled) return;

      if (!available || !containerRef.current || !window.TradingView?.widget) {
        setStatus("unavailable");
        onUnavailable?.();
        return;
      }

      // Guard against an unsupported resolution reaching the library.
      const safeResolution = resolutionToTimeframe(resolution) ? resolution : "15";

      try {
        widgetRef.current = new window.TradingView.widget({
          container: containerRef.current,
          datafeed: createApexDatafeed(),
          symbol,
          interval: safeResolution,
          library_path: "/charting_library/",
          locale: "en",
          fullscreen: false,
          autosize: true,
          theme: "Dark",
          timezone: "Etc/UTC",
          // ApeX has no server-side chart storage; keep the UI to what works.
          disabled_features: [
            "header_symbol_search",
            "header_compare",
            "save_chart_properties_to_local_storage",
          ],
          enabled_features: ["hide_left_toolbar_by_default"],
          loading_screen: { backgroundColor: "#0d0d0f" },
          overrides: {
            "paneProperties.background": "#0d0d0f",
            "paneProperties.backgroundType": "solid",
          },
        });
        setStatus("ready");
      } catch {
        setStatus("unavailable");
        onUnavailable?.();
      }
    });

    return () => {
      cancelled = true;
      try {
        widgetRef.current?.remove?.();
      } catch {
        // The library throws if it was already torn down; nothing to do.
      }
      widgetRef.current = null;
    };
  }, [symbol, resolution]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "unavailable") {
    // The caller renders its own fallback; keep this inert.
    return null;
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(13,13,15,0.6)",
          }}
        >
          <span className="t-label-caps text-text-muted">Loading TradingView…</span>
        </div>
      )}
    </div>
  );
}
