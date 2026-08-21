import { Candle, Ticker, OrderBookData } from '../exchanges/types';

const DB_NAME = 'apex_chart_cache';
const DB_VERSION = 1;

interface CachedData<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('candles')) {
          const candleStore = db.createObjectStore('candles', { keyPath: 'key' });
          candleStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('tickers')) {
          const tickerStore = db.createObjectStore('tickers', { keyPath: 'key' });
          tickerStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('orderbooks')) {
          const obStore = db.createObjectStore('orderbooks', { keyPath: 'key' });
          obStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    try {
      const store = await this.getStore(storeName);
      const request = store.get(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result as CachedData<T> | undefined;
          if (!result) {
            resolve(null);
            return;
          }

          // Check if expired
          if (Date.now() > result.expiresAt) {
            this.delete(storeName, key); // Clean up
            resolve(null);
            return;
          }

          resolve(result.data);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('IndexedDB get error:', err);
      return null;
    }
  }

  async set<T>(storeName: string, key: string, data: T, ttlMs: number = 5 * 60 * 1000): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      const cachedData: CachedData<T> = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttlMs,
      };

      const request = store.put(cachedData);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('IndexedDB set error:', err);
    }
  }

  async delete(storeName: string, key: string): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      const request = store.delete(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('IndexedDB delete error:', err);
    }
  }

  async clearExpired(): Promise<void> {
    try {
      const stores = ['candles', 'tickers', 'orderbooks'];
      const now = Date.now();

      for (const storeName of stores) {
        const store = await this.getStore(storeName, 'readwrite');
        const index = store.index('expiresAt');
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        await new Promise<void>((resolve) => {
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => resolve();
        });
      }
    } catch (err) {
      console.error('IndexedDB clearExpired error:', err);
    }
  }

  async clear(): Promise<void> {
    try {
      const stores = ['candles', 'tickers', 'orderbooks'];
      for (const storeName of stores) {
        const store = await this.getStore(storeName, 'readwrite');
        store.clear();
      }
    } catch (err) {
      console.error('IndexedDB clear error:', err);
    }
  }
}

export const cache = new IndexedDBCache();

// Clear expired entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => cache.clearExpired(), 10 * 60 * 1000);
}
