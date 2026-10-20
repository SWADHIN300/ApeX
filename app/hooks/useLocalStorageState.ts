"use client";

import { useCallback, useSyncExternalStore } from "react";

const listenersByKey = new Map<string, Set<() => void>>();

function notifyLocalStorageChange(key: string) {
  listenersByKey.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const listeners = listenersByKey.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  listenersByKey.set(key, listeners);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByKey.delete(key);
    window.removeEventListener("storage", onStorage);
  };
}

function readSnapshot(key: string) {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  parse: (serialized: string) => T = JSON.parse,
  serialize: (value: T) => string = JSON.stringify
): [T, (value: T | ((previous: T) => T)) => void] {
  const rawValue = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => readSnapshot(key),
    () => null
  );

  let value = initialValue;
  if (rawValue !== null) {
    try {
      value = parse(rawValue);
    } catch {
      value = initialValue;
    }
  }

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const rawCurrent = readSnapshot(key);
      let current = initialValue;
      if (rawCurrent !== null) {
        try {
          current = parse(rawCurrent);
        } catch {
          current = initialValue;
        }
      }
      const nextValue = typeof next === "function"
        ? (next as (previous: T) => T)(current)
        : next;
      window.localStorage.setItem(key, serialize(nextValue));
      notifyLocalStorageChange(key);
    },
    [initialValue, key, parse, serialize]
  );

  return [value, setValue];
}

export function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function useSystemDarkTheme() {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => true
  );
}
