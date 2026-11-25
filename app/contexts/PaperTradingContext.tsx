"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMarket } from "@/contexts/MarketContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { Position, PortfolioData, TradeRecord } from "@/lib/types";
import { FEE_RATE } from "@/lib/constants";

const PAPER_INITIAL_BALANCE = 10_000;
const STORAGE_KEY_ENABLED = "apex-paper-trading-enabled";
const EMPTY_POSITIONS: Position[] = [];
const EMPTY_TRADES: TradeRecord[] = [];

type PaperAccount = {
  balance: number;
  positions: Position[];
  trades: TradeRecord[];
};

export type PaperTradingContextType = {
  isPaperTrading: boolean;
  setPaperTrading: (enabled: boolean) => Promise<void>;
  paperBalance: number;
  paperPositions: Position[];
  paperTrades: TradeRecord[];
  paperPortfolio: PortfolioData;
  paperAccountWallet: string | null;
  paperAccountLoading: boolean;
  paperAccountError: string;
  placePaperOrder: (
    pair: string,
    side: "Long" | "Short",
    sizeUsdc: number,
    leverage: number,
    price: number,
  ) => void;
  closePaperPosition: (id: string, currentPrice: number) => void;
  updatePaperPositionsWithMarkPrice: (pair: string, markPrice: number) => void;
  resetPaperAccount: () => void;
};

const PaperTradingContext = createContext<PaperTradingContextType | undefined>(undefined);

function computePortfolio(balance: number, positions: Position[]): PortfolioData {
  const unrealizedPnl = positions.reduce((sum, position) => sum + position.pnl, 0);
  const usedMargin = positions.reduce(
    (sum, position) => sum + (position.size * position.entryPrice) / (position.leverage || 1),
    0,
  );
  const totalValue = balance + unrealizedPnl;
  const totalPnl = totalValue - PAPER_INITIAL_BALANCE;

  return {
    totalValue,
    totalPnl,
    totalPnlPct: (totalPnl / PAPER_INITIAL_BALANCE) * 100,
    availableMargin: Math.max(0, balance - usedMargin),
    usedMargin,
    unrealizedPnl,
  };
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Paper account request failed.");
  }
  return body as T;
}

function readLegacyLocalAccount(): PaperAccount | null {
  try {
    const balanceValue = window.localStorage.getItem("apex-paper-balance");
    const positionsValue = window.localStorage.getItem("apex-paper-positions");
    const tradesValue = window.localStorage.getItem("apex-paper-trades");
    if (balanceValue === null && positionsValue === null && tradesValue === null) return null;

    const balance = balanceValue === null ? PAPER_INITIAL_BALANCE : Number(balanceValue);
    const positions = positionsValue ? JSON.parse(positionsValue) : [];
    const trades = tradesValue ? JSON.parse(tradesValue) : [];
    if (!Number.isFinite(balance) || !Array.isArray(positions) || !Array.isArray(trades)) return null;
    return { balance, positions, trades } as PaperAccount;
  } catch {
    return null;
  }
}

function clearLegacyLocalAccount() {
  window.localStorage.removeItem("apex-paper-balance");
  window.localStorage.removeItem("apex-paper-positions");
  window.localStorage.removeItem("apex-paper-trades");
}

export function PaperTradingProvider({ children }: { children: React.ReactNode }) {
  const { network } = useNetwork();
  const { market } = useMarket();
  const { publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [enabled, setEnabled] = useLocalStorageState<boolean>(
    STORAGE_KEY_ENABLED,
    false,
    (value) => value === "true",
    (value) => String(value),
  );
  const [loadedPaperAccount, setLoadedPaperAccount] = useState<{
    walletAddress: string;
    account: PaperAccount;
  } | null>(null);
  const [paperAccountLoading, setPaperAccountLoading] = useState(false);
  const [paperAccountError, setPaperAccountError] = useState("");
  const paperAccount = loadedPaperAccount?.walletAddress === walletAddress
    ? loadedPaperAccount.account
    : null;
  const paperAccountWallet = paperAccount ? walletAddress : null;
  const paperAccountRef = useRef<PaperAccount | null>(null);
  const walletSessionRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const hydrationRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const effectivePaper = enabled && network === "devnet" && !!paperAccount && paperAccountWallet === walletAddress;
  const paperBalance = paperAccount?.balance ?? 0;
  const paperPositions = paperAccount?.positions ?? EMPTY_POSITIONS;
  const paperTrades = paperAccount?.trades ?? EMPTY_TRADES;

  useEffect(() => {
    paperAccountRef.current = paperAccount;
  }, [paperAccount]);

  // Rehydrate a previously authenticated wallet session without prompting again.
  useEffect(() => {
    let active = true;
    walletSessionRef.current = null;
    dirtyRef.current = false;

    if (!walletAddress) return () => { active = false; };

    const restoreAccount = async () => {
      if (!active) return;
      setPaperAccountLoading(true);
      setPaperAccountError("");
      try {
        const session = await responseJson<{ walletAddress: string | null }>(
          await fetch("/api/paper-trading/session", { cache: "no-store" }),
        );
        if (!active || session.walletAddress !== walletAddress) return;

        walletSessionRef.current = walletAddress;
        const result = await responseJson<{ account: PaperAccount | null }>(
          await fetch("/api/paper-trading/account", { cache: "no-store" }),
        );
        if (!active) return;
        if (result.account) {
          hydrationRef.current = true;
          setLoadedPaperAccount({ walletAddress, account: result.account });
          queueMicrotask(() => { hydrationRef.current = false; });
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Unable to restore the paper account.";
          if (!message.includes("Connect and sign in")) setPaperAccountError(message);
        }
      } finally {
        if (active) setPaperAccountLoading(false);
      }
    };
    const timer = setTimeout(() => void restoreAccount(), 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [walletAddress]);

  const scheduleAccountSave = useCallback((immediate = false) => {
    if (!paperAccountWallet || paperAccountWallet !== walletAddress) return;
    if (saveTimerRef.current && !immediate) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const accountToSave = paperAccountRef.current;
      if (!accountToSave || walletSessionRef.current !== paperAccountWallet || !dirtyRef.current) return;
      dirtyRef.current = false;
      saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
        const response = await fetch("/api/paper-trading/account", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accountToSave),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : "Unable to save the paper account.");
        }
        setPaperAccountError("");
      }).catch((error: unknown) => {
        dirtyRef.current = true;
        setPaperAccountError(error instanceof Error ? error.message : "Unable to save the paper account.");
      });
    }, immediate ? 0 : 1_000);
  }, [paperAccountWallet, walletAddress]);

  // Persist trade actions promptly and mark-price updates without extra DB writes.
  const persistAccount = useCallback((next: PaperAccount, immediate = false) => {
    if (!walletAddress) return;
    setLoadedPaperAccount({ walletAddress, account: next });
    paperAccountRef.current = next;
    dirtyRef.current = true;
    scheduleAccountSave(immediate);
  }, [scheduleAccountSave, walletAddress]);

  const setPaperTrading = useCallback(async (shouldEnable: boolean) => {
    if (!shouldEnable) {
      setEnabled(false);
      setPaperAccountError("");
      return;
    }
    if (network !== "devnet") {
      setPaperAccountError("Paper trading is available in Devnet mode only.");
      return;
    }
    if (!walletAddress || !publicKey) {
      setPaperAccountError("Connect a wallet to save and restore your paper account.");
      return;
    }
    if (!signMessage) {
      setPaperAccountError("This wallet cannot sign a sign-in message. Try Phantom or Solflare.");
      return;
    }

    setPaperAccountLoading(true);
    setPaperAccountError("");
    try {
      const signedInWallet = walletSessionRef.current;
      if (signedInWallet !== walletAddress) {
        const challenge = await responseJson<{ nonce: string; message: string }>(
          await fetch("/api/paper-trading/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "challenge", walletAddress }),
          }),
        );
        const signature = await signMessage(new TextEncoder().encode(challenge.message));
        const signatureBase64 = btoa(String.fromCharCode(...signature));
        await responseJson<{ walletAddress: string }>(
          await fetch("/api/paper-trading/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "verify",
              walletAddress,
              nonce: challenge.nonce,
              signature: signatureBase64,
            }),
          }),
        );
        walletSessionRef.current = walletAddress;
      }

      let result = await responseJson<{ account: PaperAccount | null }>(
        await fetch("/api/paper-trading/account", { cache: "no-store" }),
      );
      if (!result.account) {
        const legacyAccount = readLegacyLocalAccount();
        result = await responseJson<{ account: PaperAccount }>(
          await fetch("/api/paper-trading/account", {
            method: "POST",
            ...(legacyAccount
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ account: legacyAccount }),
                }
              : {}),
          }),
        );
      }
      clearLegacyLocalAccount();
      const account = result.account;
      if (!account) throw new Error("Unable to create or restore the paper account.");

      hydrationRef.current = true;
      setLoadedPaperAccount({ walletAddress, account });
      paperAccountRef.current = account;
      dirtyRef.current = false;
      setEnabled(true);
      queueMicrotask(() => { hydrationRef.current = false; });
    } catch (error) {
      setPaperAccountError(error instanceof Error ? error.message : "Unable to start paper trading.");
    } finally {
      setPaperAccountLoading(false);
    }
  }, [network, publicKey, setEnabled, signMessage, walletAddress]);

  const paperPortfolio = useMemo(
    () => computePortfolio(paperBalance, paperPositions),
    [paperBalance, paperPositions],
  );

  const placePaperOrder = useCallback((
    pair: string,
    side: "Long" | "Short",
    sizeUsdc: number,
    leverage: number,
    price: number,
  ) => {
    const account = paperAccountRef.current;
    if (!account || paperAccountWallet !== walletAddress || price <= 0 || sizeUsdc <= 0 || leverage <= 0) return;

    const fee = sizeUsdc * FEE_RATE;
    const margin = sizeUsdc / leverage;
    const sizeBase = sizeUsdc / price;
    const liqPrice = side === "Long"
      ? price * (1 - 1 / leverage + 0.005)
      : price * (1 + 1 / leverage - 0.005);
    const usedMargin = account.positions.reduce(
      (sum, position) => sum + (position.size * position.entryPrice) / (position.leverage || 1),
      0,
    );
    if (margin + fee > Math.max(0, account.balance - usedMargin)) return;

    const id = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const position: Position = {
      id, pair, side, leverage, size: sizeBase, entryPrice: price,
      markPrice: price, liqPrice, pnl: 0, roi: 0,
    };
    const trade: TradeRecord = {
      id, time: Math.floor(Date.now() / 1000), pair, side,
      size: sizeBase, price, fee, pnl: 0, status: "Open",
    };

    persistAccount({
      balance: account.balance - fee,
      positions: [position, ...account.positions],
      trades: [trade, ...account.trades],
    }, true);
  }, [paperAccountWallet, persistAccount, walletAddress]);

  const closePaperPosition = useCallback((id: string, currentPrice: number) => {
    const account = paperAccountRef.current;
    if (!account || paperAccountWallet !== walletAddress) return;
    const position = account.positions.find((candidate) => candidate.id === id);
    if (!position || currentPrice <= 0) return;

    const sizeUsdc = position.size * position.entryPrice;
    const fee = sizeUsdc * FEE_RATE;
    const diff = position.side === "Long"
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    const pnl = diff * position.size;
    const trade: TradeRecord = {
      id, time: Math.floor(Date.now() / 1000), pair: position.pair,
      side: position.side, size: position.size, price: currentPrice,
      fee, pnl, status: "Closed",
    };

    persistAccount({
      balance: Math.max(0, account.balance + pnl - fee),
      positions: account.positions.filter((candidate) => candidate.id !== id),
      trades: [trade, ...account.trades],
    }, true);
  }, [paperAccountWallet, persistAccount, walletAddress]);

  const updatePaperPositionsWithMarkPrice = useCallback((pair: string, markPrice: number) => {
    const account = paperAccountRef.current;
    if (!account || !walletAddress || paperAccountWallet !== walletAddress || markPrice <= 0) return;
    let changed = false;
    const positions = account.positions.map((position) => {
      if (position.pair !== pair) return position;
      const diff = position.side === "Long"
        ? markPrice - position.entryPrice
        : position.entryPrice - markPrice;
      const pnl = diff * position.size;
      const margin = (position.size * position.entryPrice) / (position.leverage || 1);
      const roi = margin > 0 ? (pnl / margin) * 100 : 0;
      if (position.markPrice === markPrice && position.pnl === pnl && position.roi === roi) return position;
      changed = true;
      return { ...position, markPrice, pnl, roi };
    });
    if (changed) {
      const updatedAccount = { ...account, positions };
      setLoadedPaperAccount({ walletAddress, account: updatedAccount });
      paperAccountRef.current = updatedAccount;
    }
  }, [paperAccountWallet, walletAddress]);

  const resetPaperAccount = useCallback(() => {
    if (paperAccountWallet !== walletAddress) return;
    persistAccount({ balance: PAPER_INITIAL_BALANCE, positions: [], trades: [] }, true);
  }, [paperAccountWallet, persistAccount, walletAddress]);

  useEffect(() => {
    if (market?.symbol && market.price > 0 && effectivePaper) {
      updatePaperPositionsWithMarkPrice(market.symbol, market.price);
    }
  }, [effectivePaper, market?.price, market?.symbol, updatePaperPositionsWithMarkPrice]);

  return (
    <PaperTradingContext.Provider value={{
      isPaperTrading: effectivePaper,
      setPaperTrading,
      paperBalance,
      paperPositions,
      paperTrades,
      paperPortfolio,
      paperAccountWallet,
      paperAccountLoading,
      paperAccountError,
      placePaperOrder,
      closePaperPosition,
      updatePaperPositionsWithMarkPrice,
      resetPaperAccount,
    }}>
      {children}
    </PaperTradingContext.Provider>
  );
}

export function usePaperTrading() {
  const context = useContext(PaperTradingContext);
  if (context === undefined) {
    throw new Error("usePaperTrading must be used within a PaperTradingProvider");
  }
  return context;
}
