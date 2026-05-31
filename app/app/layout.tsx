import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { MarketProvider } from "@/contexts/MarketContext";
import { TradeProvider } from "@/contexts/TradeContext";
import { WalletProvider } from "@/contexts/WalletProvider";

export const metadata: Metadata = {
  title: "ApeX | Perpetual Trading Terminal",
  description: "Next-gen perpetual DEX on Solana",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-bg-base text-text-main font-sans">
        <WalletProvider>
          <SettingsProvider>
            <MarketProvider>
              <TradeProvider>{children}</TradeProvider>
            </MarketProvider>
          </SettingsProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
