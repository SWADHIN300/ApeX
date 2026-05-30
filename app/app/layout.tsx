import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { MarketProvider } from "@/contexts/MarketContext";

export const metadata: Metadata = {
  title: "ApeX | Perpetual Trading Terminal",
  description: "Next-gen perpetual DEX on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-bg-base text-text-main font-sans">
        <SettingsProvider>
          <MarketProvider>{children}</MarketProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
