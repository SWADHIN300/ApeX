"use client";
import React, { createContext, useContext } from "react";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

export type Settings = {
  currency: string;
  language: string;
  oneClick: boolean;
  defaultLeverage: number;
  slippage: number;
  emailAlerts: boolean;
  browserNotifications: boolean;
  orderFills: boolean;
  twoFactor: boolean;
};

const defaultSettings: Settings = {
  currency: "USD",
  language: "en",
  oneClick: false,
  defaultLeverage: 10,
  slippage: 0.5,
  emailAlerts: true,
  browserNotifications: true,
  orderFills: true,
  twoFactor: false,
};

type SettingsContextType = {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useLocalStorageState<Settings>(
    "apex-settings",
    defaultSettings,
    (saved) => ({ ...defaultSettings, ...JSON.parse(saved) as Partial<Settings> })
  );

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
