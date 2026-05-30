"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

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
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const saved = localStorage.getItem("apex-settings");
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem("apex-settings", JSON.stringify(updated));
      return updated;
    });
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
