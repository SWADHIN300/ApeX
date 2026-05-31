"use client";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useSettings } from "@/contexts/SettingsContext";
import {
  Settings,
  User,
  Shield,
  Bell,
  Zap,
  Monitor,
  Moon,
  Sun,
  CheckCircle2,
  Circle,
  Key,
} from "lucide-react";

type SettingsTab = "general" | "trading" | "notifications" | "security";
type ThemeChoice = "dark" | "light" | "system";

type SelectOption = { value: string; label: string };

function getOptionLabel(
  options: SelectOption[],
  value: string,
  fallback: string,
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(choice: ThemeChoice) {
  const resolved = choice === "system" ? getSystemTheme() : choice;
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(resolved);
  localStorage.setItem("sol-dex-theme", choice);
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>("dark");
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { settings, updateSettings } = useSettings();
  const [saved, setSaved] = useState(false);
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);
  const [showCurrencyOptions, setShowCurrencyOptions] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<SelectOption[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<SelectOption[]>([]);
  const [cryptoCurrencyOptions, setCryptoCurrencyOptions] = useState<
    SelectOption[]
  >([]);
  const localizationOptionsLoaded = useRef(false);

  const loadLocalizationOptions = async () => {
    if (localizationOptionsLoaded.current) return;
    localizationOptionsLoaded.current = true;

    try {
      const options = await import("@/lib/localizationOptions");
      setLanguageOptions(options.languages);
      setCurrencyOptions(options.currencies);
      setCryptoCurrencyOptions(options.cryptoCurrencies);
    } catch {
      localizationOptionsLoaded.current = false;
    }
  };

  const openLanguageOptions = () => {
    setShowLanguageOptions(true);
    void loadLocalizationOptions();
  };

  const openCurrencyOptions = () => {
    setShowCurrencyOptions(true);
    void loadLocalizationOptions();
  };

  const selectedLanguageLabel = getOptionLabel(
    languageOptions,
    settings.language,
    settings.language === "en" ? "English (US)" : settings.language.toUpperCase(),
  );
  const selectedCurrencyLabel = getOptionLabel(
    [...currencyOptions, ...cryptoCurrencyOptions],
    settings.currency,
    settings.currency === "USD" ? "US Dollar (USD, $)" : settings.currency,
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("sol-dex-theme");
    const nextTheme: ThemeChoice =
      savedTheme === "light" || savedTheme === "dark" || savedTheme === "system"
        ? savedTheme
        : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const handleThemeChange = (nextTheme: ThemeChoice) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const handleSave = () => {
    // Settings auto-save to context, but this shows success feedback
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "trading", label: "Trading", icon: Zap },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Settings</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Manage your account preferences and application settings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="flex flex-col gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2 ${
                  activeTab === id
                    ? "bg-primary-container text-on-primary-container border-primary"
                    : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface border-transparent"
                }`}
              >
                <Icon size={16} />
                <span className="text-label-caps font-ui">{label}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="md:col-span-3 bg-surface border border-outline-variant">
            <div className="p-6 border-b border-outline-variant">
              <h2 className="text-headline-md font-ui text-on-surface capitalize">
                {tabs.find((t) => t.id === activeTab)?.label} Settings
              </h2>
            </div>

            <div className="p-6 space-y-8">
              {/* GENERAL TAB */}
              {activeTab === "general" && (
                <>
                  {/* Theme Selection */}
                  <div>
                    <h3 className="text-label-caps font-ui text-on-surface-variant mb-4">
                      Theme Preference
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => handleThemeChange("dark")}
                        className={`flex flex-col items-center gap-3 p-4 border transition-colors ${
                          theme === "dark"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-outline-variant text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                        }`}
                      >
                        <Moon size={24} />
                        <span className="font-ui text-body-sm">Dark Mode</span>
                      </button>
                      <button
                        onClick={() => handleThemeChange("light")}
                        className={`flex flex-col items-center gap-3 p-4 border transition-colors ${
                          theme === "light"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-outline-variant text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                        }`}
                      >
                        <Sun size={24} />
                        <span className="font-ui text-body-sm">Light Mode</span>
                      </button>
                      <button
                        onClick={() => handleThemeChange("system")}
                        className={`flex flex-col items-center gap-3 p-4 border transition-colors ${
                          theme === "system"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-outline-variant text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                        }`}
                      >
                        <Monitor size={24} />
                        <span className="font-ui text-body-sm">
                          System Default
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Localization */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                        Display Language
                      </label>
                      <select
                        value={settings.language}
                        onFocus={openLanguageOptions}
                        onMouseEnter={() => void loadLocalizationOptions()}
                        onMouseDown={openLanguageOptions}
                        onKeyDown={openLanguageOptions}
                        onChange={(e) =>
                          updateSettings({ language: e.target.value })
                        }
                        className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                      >
                        {showLanguageOptions ? (
                          languageOptions.map((language) => (
                            <option
                              key={language.value}
                              value={language.value}
                              className="bg-bg-l2 text-text-main"
                            >
                              {language.label}
                            </option>
                          ))
                        ) : (
                          <option
                            value={settings.language}
                            className="bg-bg-l2 text-text-main"
                          >
                            {selectedLanguageLabel}
                          </option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                        Display Currency
                      </label>
                      <select
                        value={settings.currency}
                        onFocus={openCurrencyOptions}
                        onMouseEnter={() => void loadLocalizationOptions()}
                        onMouseDown={openCurrencyOptions}
                        onKeyDown={openCurrencyOptions}
                        onChange={(e) =>
                          updateSettings({ currency: e.target.value })
                        }
                        className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                      >
                        {showCurrencyOptions ? (
                          <>
                            {currencyOptions.map((currency) => (
                              <option
                                key={currency.value}
                                value={currency.value}
                                className="bg-bg-l2 text-text-main"
                              >
                                {currency.label}
                              </option>
                            ))}
                            <optgroup
                              label="Crypto"
                              className="bg-bg-l2 text-text-main font-bold"
                            >
                              {cryptoCurrencyOptions.map((currency) => (
                                <option
                                  key={currency.value}
                                  value={currency.value}
                                  className="bg-bg-l2 text-text-main font-normal"
                                >
                                  {currency.label}
                                </option>
                              ))}
                            </optgroup>
                          </>
                        ) : (
                          <option
                            value={settings.currency}
                            className="bg-bg-l2 text-text-main"
                          >
                            {selectedCurrencyLabel}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* TRADING TAB */}
              {activeTab === "trading" && (
                <>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-ui text-body-md text-on-surface">
                        One-Click Trading
                      </div>
                      <div className="font-ui text-body-sm text-on-surface-variant mt-1">
                        Submit orders without confirmation dialogs.
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings({ oneClick: !settings.oneClick })
                      }
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.oneClick ? "bg-primary" : "bg-outline-variant"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                          settings.oneClick ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="border-t border-outline-variant pt-6">
                    <label className="text-label-caps font-ui text-on-surface-variant block mb-3">
                      Default Leverage
                    </label>
                    <div className="flex gap-3">
                      {[1, 5, 10, 20, 50].map((val) => (
                        <button
                          key={val}
                          onClick={() =>
                            updateSettings({ defaultLeverage: val })
                          }
                          className={`flex-1 py-2 font-data text-data-md border transition-colors ${
                            settings.defaultLeverage === val
                              ? "bg-primary-container text-on-primary-container border-primary"
                              : "bg-surface-low border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
                          }`}
                        >
                          {val}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-outline-variant pt-6">
                    <label className="text-label-caps font-ui text-on-surface-variant block mb-3">
                      Slippage Tolerance
                    </label>
                    <div className="flex gap-3">
                      {[0.1, 0.5, 1.0, 5.0].map((val) => (
                        <button
                          key={val}
                          onClick={() => updateSettings({ slippage: val })}
                          className={`flex-1 py-2 font-data text-data-md border transition-colors ${
                            settings.slippage === val
                              ? "bg-primary-container text-on-primary-container border-primary"
                              : "bg-surface-low border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  {[
                    {
                      label: "Email Alerts",
                      sub: "Receive daily PnL summaries and liquidation warnings.",
                      field: "emailAlerts" as keyof typeof settings,
                    },
                    {
                      label: "Browser Notifications",
                      sub: "Get desktop alerts when orders are filled.",
                      field: "browserNotifications" as keyof typeof settings,
                    },
                    {
                      label: "Order Fill Sounds",
                      sub: "Play a sound when a limit or stop order executes.",
                      field: "orderFills" as keyof typeof settings,
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <div className="font-ui text-body-md text-on-surface">
                          {item.label}
                        </div>
                        <div className="font-ui text-body-sm text-on-surface-variant mt-1">
                          {item.sub}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          updateSettings({
                            [item.field]: !settings[item.field],
                          })
                        }
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          settings[item.field]
                            ? "bg-primary"
                            : "bg-outline-variant"
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                            settings[item.field] ? "left-7" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* SECURITY TAB */}
              {activeTab === "security" && (
                <>
                  <div className="flex items-center justify-between pb-6 border-b border-outline-variant">
                    <div>
                      <div className="font-ui text-body-md text-on-surface">
                        Two-Factor Authentication (2FA)
                      </div>
                      <div className="font-ui text-body-sm text-on-surface-variant mt-1">
                        Protect withdrawals and account changes with an
                        authenticator app.
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateSettings({ twoFactor: !settings.twoFactor })
                      }
                      className={`px-4 py-2 font-ui text-label-caps transition-colors ${
                        settings.twoFactor
                          ? "border border-error text-error hover:bg-error/10"
                          : "bg-primary text-on-primary hover:opacity-90"
                      }`}
                    >
                      {settings.twoFactor ? "Disable 2FA" : "Enable 2FA"}
                    </button>
                  </div>

                  <div className="pt-2">
                    <h3 className="text-label-caps font-ui text-on-surface-variant mb-4">
                      API Keys
                    </h3>
                    <div className="bg-surface-low border border-outline-variant p-4 flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Key size={18} className="text-on-surface-variant" />
                        <div>
                          <div className="font-data text-data-md text-on-surface">
                            Trading Bot Main
                          </div>
                          <div className="font-ui text-body-sm text-on-surface-variant">
                            Created May 10, 2024
                          </div>
                        </div>
                      </div>
                      <button className="text-error font-ui text-label-caps hover:underline">
                        Revoke
                      </button>
                    </div>
                    <button className="w-full py-3 border border-dashed border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline transition-colors font-ui text-label-caps">
                      + Generate New API Key
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer Action */}
            <div className="p-6 border-t border-outline-variant bg-surface-container flex items-center justify-end gap-4">
              {saved && (
                <span className="flex items-center gap-2 font-ui text-body-sm text-long">
                  <CheckCircle2 size={16} />
                  Settings saved successfully
                </span>
              )}
              <button
                onClick={handleSave}
                className="bg-zinc-950 border border-zinc-700 text-zinc-50 font-bold px-6 py-2.5 font-ui text-label-caps uppercase hover:bg-zinc-900 hover:border-zinc-500 transition-all rounded-sm shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

