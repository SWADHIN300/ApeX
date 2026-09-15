/**
 * A TradingView Advanced Charts datafeed backed by ApeX's own UDF endpoints.
 *
 * This implements the subset of the Datafeed API that Advanced Charts requires,
 * talking to `/api/udf/*` — which serves candles the indexer aggregated from
 * on-chain `OrderFilled` events. It is written against the library's runtime
 * contract rather than its TypeScript types, because those types ship with the
 * licensed library and are not available at build time here.
 */

import { UDF_RESOLUTIONS } from "./udf";

type UdfBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Builds the datafeed object passed to `new TradingView.widget({ datafeed })`.
 *
 * `pollIntervalMs` controls how often the most recent bar is refreshed for
 * real-time updates; ApeX has no tick stream, so the latest bar is re-polled.
 */
export function createApexDatafeed(pollIntervalMs: number = 5_000) {
  // Active realtime subscriptions, keyed by the library's subscriber uid.
  const subscriptions = new Map<string, ReturnType<typeof setInterval>>();

  return {
    onReady(callback: (config: unknown) => void) {
      void getJson<unknown>("/api/udf/config").then((config) => {
        // The library requires this callback to be asynchronous.
        setTimeout(
          () =>
            callback(
              config ?? {
                supported_resolutions: UDF_RESOLUTIONS,
                supports_search: true,
                supports_marks: false,
                supports_time: true,
              },
            ),
          0,
        );
      });
    },

    searchSymbols(
      userInput: string,
      _exchange: string,
      _symbolType: string,
      onResult: (items: unknown[]) => void,
    ) {
      void getJson<unknown[]>(
        `/api/udf/search?query=${encodeURIComponent(userInput)}`,
      ).then((items) => onResult(items ?? []));
    },

    resolveSymbol(
      symbolName: string,
      onResolve: (info: unknown) => void,
      onError: (reason: string) => void,
    ) {
      void getJson<Record<string, unknown>>(
        `/api/udf/symbols?symbol=${encodeURIComponent(symbolName)}`,
      ).then((info) => {
        if (!info || (info as { s?: string }).s === "error") {
          onError(`Unknown symbol ${symbolName}`);
          return;
        }
        setTimeout(() => onResolve(info), 0);
      });
    },

    getBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      periodParams: { from: number; to: number; firstDataRequest: boolean },
      onResult: (bars: UdfBar[], meta: { noData: boolean; nextTime?: number }) => void,
      onError: (reason: string) => void,
    ) {
      const ticker = symbolInfo.ticker || symbolInfo.name || "";
      const params = new URLSearchParams({
        symbol: ticker,
        resolution,
        from: String(periodParams.from),
        to: String(periodParams.to),
      });

      void getJson<{
        s: string;
        errmsg?: string;
        nextTime?: number;
        t?: number[];
        o?: number[];
        h?: number[];
        l?: number[];
        c?: number[];
        v?: number[];
      }>(`/api/udf/history?${params.toString()}`).then((payload) => {
        if (!payload) {
          onError("History request failed");
          return;
        }

        if (payload.s === "no_data") {
          onResult([], { noData: true, nextTime: payload.nextTime });
          return;
        }

        if (payload.s !== "ok" || !payload.t) {
          onError(payload.errmsg || "History request failed");
          return;
        }

        const bars: UdfBar[] = payload.t.map((time, index) => ({
          // The library expects milliseconds.
          time: time * 1000,
          open: payload.o![index],
          high: payload.h![index],
          low: payload.l![index],
          close: payload.c![index],
          volume: payload.v![index],
        }));

        onResult(bars, { noData: bars.length === 0 });
      });
    },

    subscribeBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      onTick: (bar: UdfBar) => void,
      subscriberUID: string,
    ) {
      const ticker = symbolInfo.ticker || symbolInfo.name || "";

      const poll = async () => {
        const to = Math.floor(Date.now() / 1000);
        // A generous lookback so the current bucket is always included.
        const from = to - 60 * 60 * 24 * 2;
        const params = new URLSearchParams({
          symbol: ticker,
          resolution,
          from: String(from),
          to: String(to),
        });

        const payload = await getJson<{
          s: string;
          t?: number[];
          o?: number[];
          h?: number[];
          l?: number[];
          c?: number[];
          v?: number[];
        }>(`/api/udf/history?${params.toString()}`);

        if (!payload || payload.s !== "ok" || !payload.t || payload.t.length === 0) return;

        const last = payload.t.length - 1;
        onTick({
          time: payload.t[last] * 1000,
          open: payload.o![last],
          high: payload.h![last],
          low: payload.l![last],
          close: payload.c![last],
          volume: payload.v![last],
        });
      };

      void poll();
      subscriptions.set(subscriberUID, setInterval(poll, pollIntervalMs));
    },

    unsubscribeBars(subscriberUID: string) {
      const timer = subscriptions.get(subscriberUID);
      if (timer) {
        clearInterval(timer);
        subscriptions.delete(subscriberUID);
      }
    },
  };
}
