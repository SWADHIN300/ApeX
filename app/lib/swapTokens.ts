export type SwapNetwork = "devnet" | "mainnet-beta";

export type SwapToken = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  network: SwapNetwork;
};

const mainnetTokens: SwapToken[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    network: "mainnet-beta",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    network: "mainnet-beta",
  },
  {
    symbol: "USDT",
    name: "Tether",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkYQn2oMcdi9xHFH",
    decimals: 6,
    network: "mainnet-beta",
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    network: "mainnet-beta",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3rDtvXf2nStStGwSyG8Lr8KKR9",
    decimals: 5,
    network: "mainnet-beta",
  },
  {
    symbol: "RAY",
    name: "Raydium",
    mint: "4k3Dyjzvzp8eMZWUX1G1GJAvP6TgNAWHnhVUd7VCx4mS",
    decimals: 6,
    network: "mainnet-beta",
  },
  {
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    mint: "mSoLzYCxHdqgRqY3f7zY8nYkD6E4e5F2uKftmTgX4B3",
    decimals: 9,
    network: "mainnet-beta",
  },
];

const devnetTokens: SwapToken[] = [
  {
    symbol: "SOL",
    name: "Devnet SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    network: "devnet",
  },
  {
    symbol: "USDC",
    name: "Devnet USDC",
    mint:
      process.env.NEXT_PUBLIC_APEX_DEVNET_USDC_MINT ??
      process.env.NEXT_PUBLIC_APEX_USDC_MINT ??
      "",
    decimals: 6,
    network: "devnet",
  },
];

export function getSwapTokens(network: SwapNetwork) {
  return (network === "mainnet-beta" ? mainnetTokens : devnetTokens).filter(
    (token) => token.mint.length > 0,
  );
}

export function toAtomicAmount(amount: string, decimals: number) {
  const [wholePart, fractionPart = ""] = amount.trim().split(".");
  const whole = wholePart.replace(/\D/g, "") || "0";
  const fraction = fractionPart.replace(/\D/g, "").slice(0, decimals);
  const paddedFraction = fraction.padEnd(decimals, "0");

  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
}

export function fromAtomicAmount(amount: string, decimals: number) {
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole;
}
