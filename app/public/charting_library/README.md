# TradingView Advanced Charts

This directory is where the TradingView **Advanced Charts** library goes. It is
intentionally empty in git — the library cannot be redistributed, so it is not
committed and is not available on npm.

ApeX works without it: `components/CandlestickChart.tsx` renders with
[`lightweight-charts`](https://github.com/tradingview/lightweight-charts)
(TradingView's open-source, MIT-licensed charting library, already a dependency).
`components/TradingViewChart.tsx` upgrades to Advanced Charts automatically once
the files below exist, and silently falls back when they don't.

## Why the extra step

| | lightweight-charts | Advanced Charts |
|---|---|---|
| License | MIT, on npm | Free, but access granted on request |
| Redistributable | Yes | No — cannot be committed to a public repo |
| Drawing tools, indicators | Minimal | Full suite |
| Custom data | Yes | Yes, via the Datafeed API |

## Getting access

1. Request the library from TradingView: https://www.tradingview.com/advanced-charts/
2. They grant access to the private `charting_library` GitHub repository.
3. Copy the distribution into this directory so the following resolve:

```
public/charting_library/charting_library.standalone.js
public/charting_library/bundles/...
```

That's all — no configuration or code changes. `TradingViewChart` probes for
`charting_library.standalone.js` on mount and initializes the widget when found.

## How ApeX data reaches the chart

Advanced Charts pulls bars over the Universal Data Feed (UDF) contract, served
from this app:

| Endpoint | Purpose |
|---|---|
| `GET /api/udf/config` | Advertised capabilities and resolutions |
| `GET /api/udf/symbols?symbol=` | Symbol metadata |
| `GET /api/udf/history?symbol=&resolution=&from=&to=` | OHLCV bars |
| `GET /api/udf/search?query=` | Symbol search |
| `GET /api/udf/time` | Server time |

Those read the `candles` table, which the `indexer/` service builds from the
program's on-chain `OrderFilled` events. So the chart shows **ApeX's own trades**,
not a centralized exchange feed.

Bars only exist once the protocol has fills. Run the `market-maker/` service to
seed order book liquidity, otherwise the chart is legitimately empty and the
terminal says so rather than showing fabricated data.

`lib/tradingViewDatafeed.ts` implements the datafeed client and is written
against the library's runtime contract, since the TypeScript definitions ship
with the licensed library and aren't present at build time.
