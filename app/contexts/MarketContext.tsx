'use client'
import React, { createContext, useContext, useState } from 'react'

export type MarketInfo = {
  pair: string
  basePrice: number
  change24h: number
  fundingRate: number
  openInterest: string
}

export const AVAILABLE_MARKETS: MarketInfo[] = [
  { pair: 'BTC-PERP', basePrice: 65432.1, change24h: 2.4, fundingRate: 0.0100, openInterest: '120M' },
  { pair: 'SOL-PERP', basePrice: 145.2, change24h: 5.2, fundingRate: 0.0150, openInterest: '45M' },
  { pair: 'ETH-PERP', basePrice: 3450.5, change24h: -1.2, fundingRate: 0.0050, openInterest: '80M' },
]

type MarketContextType = {
  market: MarketInfo
  setMarket: (market: MarketInfo) => void
}

const MarketContext = createContext<MarketContextType | undefined>(undefined)

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarket] = useState<MarketInfo>(AVAILABLE_MARKETS[0])

  return (
    <MarketContext.Provider value={{ market, setMarket }}>
      {children}
    </MarketContext.Provider>
  )
}

export function useMarket() {
  const context = useContext(MarketContext)
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider')
  }
  return context
}
