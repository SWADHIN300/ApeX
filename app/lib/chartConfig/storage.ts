import { DrawingTool, Indicators } from '@/components/ChartPanel';

export interface ChartDrawing {
  id: string;
  type: DrawingTool;
  points: { time: number; price: number }[];
  color?: string;
  lineWidth?: number;
  label?: string;
}

export interface ChartConfiguration {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  indicators: Indicators & {
    rsi?: boolean;
    macd?: boolean;
    bollingerBands?: boolean;
    ema?: boolean;
    stochastic?: boolean;
    atr?: boolean;
    vwap?: boolean;
    obv?: boolean;
  };
  drawings: ChartDrawing[];
  chartType: 'candlestick' | 'line' | 'area' | 'heikin-ashi';
  theme?: 'dark' | 'light';
  exchange?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'apex_chart_configs';
const MAX_CONFIGS = 50;

export class ChartConfigStorage {
  // Save configuration
  save(config: Omit<ChartConfiguration, 'id' | 'createdAt' | 'updatedAt'>): ChartConfiguration {
    const configs = this.loadAll();
    
    const newConfig: ChartConfiguration = {
      ...config,
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    configs.unshift(newConfig);

    // Limit number of saved configs
    if (configs.length > MAX_CONFIGS) {
      configs.splice(MAX_CONFIGS);
    }

    this.saveAll(configs);
    return newConfig;
  }

  // Update existing configuration
  update(id: string, updates: Partial<ChartConfiguration>): ChartConfiguration | null {
    const configs = this.loadAll();
    const index = configs.findIndex(c => c.id === id);

    if (index === -1) return null;

    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: Date.now()
    };

    this.saveAll(configs);
    return configs[index];
  }

  // Load single configuration
  load(id: string): ChartConfiguration | null {
    const configs = this.loadAll();
    return configs.find(c => c.id === id) || null;
  }

  // Load all configurations
  loadAll(): ChartConfiguration[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (err) {
      console.error('Error loading chart configs:', err);
      return [];
    }
  }

  // Load by symbol
  loadBySymbol(symbol: string): ChartConfiguration[] {
    return this.loadAll().filter(c => c.symbol === symbol);
  }

  // Delete configuration
  delete(id: string): boolean {
    const configs = this.loadAll();
    const filtered = configs.filter(c => c.id !== id);
    
    if (filtered.length === configs.length) return false;
    
    this.saveAll(filtered);
    return true;
  }

  // Export configuration as JSON
  export(id: string): string | null {
    const config = this.load(id);
    if (!config) return null;
    return JSON.stringify(config, null, 2);
  }

  // Import configuration from JSON
  import(jsonString: string): ChartConfiguration | null {
    try {
      const config = JSON.parse(jsonString);
      
      // Validate required fields
      if (!config.name || !config.symbol || !config.timeframe) {
        throw new Error('Invalid configuration format');
      }

      // Remove id to create new config
      delete config.id;
      delete config.createdAt;
      delete config.updatedAt;

      return this.save(config);
    } catch (err) {
      console.error('Error importing chart config:', err);
      return null;
    }
  }

  // Clear all configurations
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveAll(configs: ChartConfiguration[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (err) {
      console.error('Error saving chart configs:', err);
    }
  }

  private generateId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const chartConfigStorage = new ChartConfigStorage();

// Export utilities
export function downloadConfig(config: ChartConfiguration): void {
  const dataStr = JSON.stringify(config, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${config.name.replace(/\s+/g, '_')}_${config.symbol}_chart.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

export function uploadConfig(file: File): Promise<ChartConfiguration | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const config = chartConfigStorage.import(content);
      resolve(config);
    };
    
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
