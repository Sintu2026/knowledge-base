"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/*
 * Per-viewer JSON state in localStorage (SOP checklists, and anything else
 * §11 keeps off the server), read through useSyncExternalStore: the server
 * snapshot is the fallback (hydration-safe), and same-tab writes re-render
 * through a custom event because the browser's "storage" event only fires
 * in other tabs.
 */

const CHANGE_EVENT = "kb-local-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function useLocalJson<T>(
  key: string,
  fallback: T,
): [T, (update: (prev: T) => T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const value = useMemo<T>(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback is a stable literal at call sites
  }, [raw]);

  const set = useCallback(
    (update: (prev: T) => T) => {
      try {
        const current = localStorage.getItem(key);
        const prev = current === null ? fallback : (JSON.parse(current) as T);
        localStorage.setItem(key, JSON.stringify(update(prev)));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch {
        // Private-mode storage failures just lose the state.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback is a stable literal at call sites
    [key],
  );

  return [value, set];
}
