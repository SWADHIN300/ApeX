"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";

export interface AdvancedIndicatorConfig {
  // Moving Averages
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  ema12: boolean;
  ema26: boolean;
  ema50: boolean;
  
  // Oscillators
  rsi: boolean;
  rsiPeriod: number;
  macd: boolean;
  stochastic: boolean;
  
  // Volatility
  bollingerBands: boolean;
  bbPeriod: number;
  bbStdDev: number;
  atr: boolean;
  atrPeriod: number;
  
  // Volume
  volume: boolean;
  vwap: boolean;
  obv: boolean;
  
  // Other
  fibonacci: boolean;
}

interface Props {
  config: AdvancedIndicatorConfig;
  onChange: (config: AdvancedIndicatorConfig) => void;
}

export default function AdvancedIndicators({ config, onChange }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>('moving-averages');

  const toggle = (key: keyof AdvancedIndicatorConfig, value?: any) => {
    onChange({
      ...config,
      [key]: value !== undefined ? value : !config[key]
    });
  };

  const sections = [
    {
      id: 'moving-averages',
      title: 'Moving Averages',
      items: [
        { key: 'sma20', label: 'SMA 20', color: 'rgba(41,98,255,0.8)' },
        { key: 'sma50', label: 'SMA 50', color: 'rgba(255,109,0,0.8)' },
        { key: 'sma200', label: 'SMA 200', color: 'rgba(156,39,176,0.8)' },
        { key: 'ema12', label: 'EMA 12', color: 'rgba(0,188,212,0.8)' },
        { key: 'ema26', label: 'EMA 26', color: 'rgba(255,193,7,0.8)' },
        { key: 'ema50', label: 'EMA 50', color: 'rgba(233,30,99,0.8)' },
      ]
    },
    {
      id: 'oscillators',
      title: 'Oscillators',
      items: [
        { 
          key: 'rsi', 
          label: 'RSI', 
          color: 'rgba(156,39,176,0.8)',
          settings: [
            { key: 'rsiPeriod', label: 'Period', type: 'number', min: 2, max: 100, default: 14 }
          ]
        },
        { key: 'macd', label: 'MACD', color: 'rgba(33,150,243,0.8)' },
        { key: 'stochastic', label: 'Stochastic', color: 'rgba(255,152,0,0.8)' },
      ]
    },
    {
      id: 'volatility',
      title: 'Volatility',
      items: [
        { 
          key: 'bollingerBands', 
          label: 'Bollinger Bands', 
          color: 'rgba(76,175,80,0.8)',
          settings: [
            { key: 'bbPeriod', label: 'Period', type: 'number', min: 2, max: 100, default: 20 },
            { key: 'bbStdDev', label: 'Std Dev', type: 'number', min: 1, max: 5, default: 2, step: 0.1 }
          ]
        },
        { 
          key: 'atr', 
          label: 'ATR', 
          color: 'rgba(255,87,34,0.8)',
          settings: [
            { key: 'atrPeriod', label: 'Period', type: 'number', min: 2, max: 100, default: 14 }
          ]
        },
      ]
    },
    {
      id: 'volume',
      title: 'Volume',
      items: [
        { key: 'volume', label: 'Volume', color: 'rgba(29,158,117,0.5)' },
        { key: 'vwap', label: 'VWAP', color: 'rgba(255,235,59,0.8)' },
        { key: 'obv', label: 'OBV', color: 'rgba(103,58,183,0.8)' },
      ]
    },
    {
      id: 'other',
      title: 'Other',
      items: [
        { key: 'fibonacci', label: 'Fibonacci Retracement', color: 'rgba(121,85,72,0.8)' },
      ]
    }
  ];

  return (
    <div className="w-72 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl max-h-[600px] overflow-y-auto">
      <div className="sticky top-0 bg-bg-l1 z-10 flex items-center justify-between px-3 py-2 bb-thin">
        <span className="t-label-caps text-text-muted">Advanced Indicators</span>
        <button
          onClick={() => {
            const allOff = Object.keys(config).every(k => 
              typeof config[k as keyof AdvancedIndicatorConfig] === 'boolean' 
                ? !config[k as keyof AdvancedIndicatorConfig] 
                : true
            );
            const newConfig = { ...config };
            Object.keys(newConfig).forEach(k => {
              if (typeof newConfig[k as keyof AdvancedIndicatorConfig] === 'boolean') {
                (newConfig as any)[k] = allOff;
              }
            });
            onChange(newConfig);
          }}
          className="t-label-caps text-primary hover:text-primary-hover transition-colors"
        >
          {Object.keys(config).some(k => 
            typeof config[k as keyof AdvancedIndicatorConfig] === 'boolean' 
              && config[k as keyof AdvancedIndicatorConfig]
          ) ? 'Clear All' : 'Enable All'}
        </button>
      </div>

      {sections.map(section => (
        <div key={section.id} className="bb-thin">
          <button
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-bg-l2 transition-colors"
          >
            <span className="t-body-sm font-medium text-text-main">{section.title}</span>
            <ChevronRight 
              size={14} 
              className={`text-text-dim transition-transform ${
                expandedSection === section.id ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSection === section.id && (
            <div className="pb-2">
              {section.items.map((item) => (
                <div key={item.key} className="px-3">
                  <button
                    onClick={() => toggle(item.key as keyof AdvancedIndicatorConfig)}
                    className="w-full flex items-center gap-3 py-2.5 hover:bg-bg-l2 rounded transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border-2"
                      style={{
                        background: config[item.key as keyof AdvancedIndicatorConfig] 
                          ? item.color 
                          : 'transparent',
                        borderColor: item.color,
                      }}
                    />
                    <span className="t-body-sm text-text-main flex-1 text-left">{item.label}</span>
                    {config[item.key as keyof AdvancedIndicatorConfig] && (
                      <Check size={12} className="text-primary" />
                    )}
                  </button>

                  {/* Settings for this indicator */}
                  {item.settings && config[item.key as keyof AdvancedIndicatorConfig] && (
                    <div className="ml-6 mt-1 mb-2 space-y-2">
                      {item.settings.map(setting => (
                        <div key={setting.key} className="flex items-center justify-between gap-3">
                          <label className="t-body-xs text-text-dim">{setting.label}:</label>
                          <input
                            type={setting.type}
                            min={setting.min}
                            max={setting.max}
                            step={'step' in setting ? setting.step : 1}
                            value={config[setting.key as keyof AdvancedIndicatorConfig] as number}
                            onChange={(e) => toggle(
                              setting.key as keyof AdvancedIndicatorConfig, 
                              parseFloat(e.target.value)
                            )}
                            className="w-16 px-2 py-1 bg-bg-l3 border border-t-border rounded text-text-main t-body-xs focus:outline-none focus:border-primary"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
