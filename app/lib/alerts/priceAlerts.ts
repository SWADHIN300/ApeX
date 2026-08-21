export type AlertCondition = 'above' | 'below' | 'crosses_above' | 'crosses_below';
export type AlertStatus = 'active' | 'triggered' | 'expired' | 'cancelled';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice: number;
  message: string;
  createdAt: number;
  expiresAt?: number;
  status: AlertStatus;
  triggeredAt?: number;
  lastPrice?: number;
}

const STORAGE_KEY = 'apex_price_alerts';

export class PriceAlertManager {
  private alerts: Map<string, PriceAlert> = new Map();
  private priceCache: Map<string, number> = new Map();
  private listeners: Set<(alert: PriceAlert) => void> = new Set();

  constructor() {
    this.loadAlerts();
    this.startMonitoring();
  }

  // Create new alert
  create(
    symbol: string,
    condition: AlertCondition,
    targetPrice: number,
    message: string,
    expiresIn?: number
  ): PriceAlert {
    const alert: PriceAlert = {
      id: this.generateId(),
      symbol,
      condition,
      targetPrice,
      message,
      createdAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
      status: 'active'
    };

    this.alerts.set(alert.id, alert);
    this.saveAlerts();
    return alert;
  }

  // Update price and check alerts
  updatePrice(symbol: string, price: number): void {
    const prevPrice = this.priceCache.get(symbol);
    this.priceCache.set(symbol, price);

    for (const alert of this.alerts.values()) {
      if (alert.symbol !== symbol || alert.status !== 'active') continue;

      // Check expiration
      if (alert.expiresAt && Date.now() > alert.expiresAt) {
        alert.status = 'expired';
        this.saveAlerts();
        continue;
      }

      let triggered = false;

      switch (alert.condition) {
        case 'above':
          triggered = price > alert.targetPrice;
          break;
        case 'below':
          triggered = price < alert.targetPrice;
          break;
        case 'crosses_above':
          if (prevPrice !== undefined) {
            triggered = prevPrice <= alert.targetPrice && price > alert.targetPrice;
          }
          break;
        case 'crosses_below':
          if (prevPrice !== undefined) {
            triggered = prevPrice >= alert.targetPrice && price < alert.targetPrice;
          }
          break;
      }

      if (triggered) {
        alert.status = 'triggered';
        alert.triggeredAt = Date.now();
        alert.lastPrice = price;
        this.saveAlerts();
        this.notifyListeners(alert);
        this.showNotification(alert, price);
      }
    }
  }

  // Get all alerts
  getAll(): PriceAlert[] {
    return Array.from(this.alerts.values());
  }

  // Get active alerts for symbol
  getActiveForSymbol(symbol: string): PriceAlert[] {
    return Array.from(this.alerts.values()).filter(
      a => a.symbol === symbol && a.status === 'active'
    );
  }

  // Get alert by id
  get(id: string): PriceAlert | undefined {
    return this.alerts.get(id);
  }

  // Cancel alert
  cancel(id: string): boolean {
    const alert = this.alerts.get(id);
    if (!alert) return false;

    alert.status = 'cancelled';
    this.saveAlerts();
    return true;
  }

  // Delete alert
  delete(id: string): boolean {
    const deleted = this.alerts.delete(id);
    if (deleted) this.saveAlerts();
    return deleted;
  }

  // Clear all alerts
  clearAll(): void {
    this.alerts.clear();
    this.saveAlerts();
  }

  // Add listener for triggered alerts
  addListener(callback: (alert: PriceAlert) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(alert: PriceAlert): void {
    this.listeners.forEach(listener => {
      try {
        listener(alert);
      } catch (err) {
        console.error('Alert listener error:', err);
      }
    });
  }

  private showNotification(alert: PriceAlert, price: number): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(`Price Alert: ${alert.symbol}`, {
        body: `${alert.message}\nCurrent price: $${price.toFixed(2)}`,
        icon: '/icon.png',
        tag: alert.id
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showNotification(alert, price);
        }
      });
    }
  }

  private loadAlerts(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const alerts: PriceAlert[] = JSON.parse(stored);
        alerts.forEach(alert => this.alerts.set(alert.id, alert));
      }
    } catch (err) {
      console.error('Error loading alerts:', err);
    }
  }

  private saveAlerts(): void {
    try {
      const alerts = Array.from(this.alerts.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (err) {
      console.error('Error saving alerts:', err);
    }
  }

  private startMonitoring(): void {
    // Clean up expired alerts every minute
    setInterval(() => {
      let changed = false;
      for (const alert of this.alerts.values()) {
        if (alert.status === 'active' && alert.expiresAt && Date.now() > alert.expiresAt) {
          alert.status = 'expired';
          changed = true;
        }
      }
      if (changed) this.saveAlerts();
    }, 60 * 1000);
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const priceAlertManager = new PriceAlertManager();

// Request notification permission on initialization
if (typeof window !== 'undefined' && 'Notification' in window) {
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
