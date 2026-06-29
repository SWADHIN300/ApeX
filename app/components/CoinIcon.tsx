"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Renders a circular coin/token icon fetched from CoinGecko's public assets.
 * Falls back to a text-initial avatar if the image fails to load.
 */
export default function CoinIcon({
  symbol,
  size = 20,
}: {
  symbol: string;
  size?: number;
}) {
  const [hasError, setHasError] = useState(false);

  // Extract the base symbol (e.g. "BTC" from "BTC-PERP")
  const base = symbol.replace(/-PERP$/i, "").toLowerCase();

  // Use CoinGecko's static asset CDN for coin icons
  const iconUrl = `https://assets.coingecko.com/coins/images/1/small/${base}.png`;

  // Map common symbols to known CoinGecko icon paths
  const KNOWN_ICONS: Record<string, string> = {
    btc: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    sol: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    bnb: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    xrp: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
    doge: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png",
    ada: "https://assets.coingecko.com/coins/images/975/small/cardano.png",
    avax: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
    dot: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png",
    matic: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
    link: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
    uni: "https://assets.coingecko.com/coins/images/12504/small/uni.png",
    atom: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png",
    ltc: "https://assets.coingecko.com/coins/images/2/small/litecoin.png",
    pepe: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
    shib: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",
    arb: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
    op: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
    sui: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
    apt: "https://assets.coingecko.com/coins/images/26455/small/aptos_round.png",
    near: "https://assets.coingecko.com/coins/images/10365/small/near.jpg",
    fil: "https://assets.coingecko.com/coins/images/12817/small/filecoin.png",
    trx: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png",
    wif: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg",
    jup: "https://assets.coingecko.com/coins/images/34188/small/jup.png",
    bonk: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg",
    render: "https://assets.coingecko.com/coins/images/11636/small/rndr.png",
    inj: "https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png",
    ftm: "https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png",
    sei: "https://assets.coingecko.com/coins/images/28205/small/Sei_Logo_-_Transparent.png",
    mana: "https://assets.coingecko.com/coins/images/878/small/decentraland-mana.png",
    sand: "https://assets.coingecko.com/coins/images/12129/small/sandbox_logo.jpg",
  };

  const resolvedUrl = KNOWN_ICONS[base] || iconUrl;

  if (hasError) {
    // Fallback: show a colored circle with the first letter
    const hue = base.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `hsl(${hue}, 55%, 45%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
        }}
      >
        {base.charAt(0)}
      </div>
    );
  }

  return (
    <Image
      src={resolvedUrl}
      alt={`${base} icon`}
      width={size}
      height={size}
      className="coin-icon"
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
}
