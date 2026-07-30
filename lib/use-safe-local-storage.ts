import { useEffect, useRef, useState } from 'react';

// Unlike @uidotdev/usehooks' useLocalStorage, this survives blocked storage
// access (throws SecurityError) and corrupted values (JSON.parse throws),
// both of which crashed the page during render (#92). The initial value is a
// factory so time-derived fallbacks (e.g. a reminder delay anchor) are
// computed fresh whenever they are needed, not captured at render time.
export const useSafeLocalStorage = <T>(
  key: string,
  getInitialValue: () => T,
) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? getInitialValue() : JSON.parse(raw);
    } catch {
      return getInitialValue();
    }
  });

  // The factory only closes over constants, so the mount-time one stays
  // correct for the storage handlers below
  const getInitialValueRef = useRef(getInitialValue);

  // Match the replaced hook: persist the initial value so time-based state
  // survives reloads, and follow changes made in other tabs
  useEffect(() => {
    // Storage itself is the authority; events only signal that it changed.
    // Reading it fresh (instead of trusting event.newValue) keeps
    // concurrently-writing tabs convergent, and a missing or corrupt entry
    // is repaired with a fresh fallback so state and storage always hold
    // the same value — a deleted entry is never resurrected.
    const syncFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) {
          try {
            setValue(JSON.parse(raw));
            return;
          } catch {
            // Corrupted entry (the #92 scenario); repair below
          }
        }
        const fallback = getInitialValueRef.current();
        setValue(fallback);
        window.localStorage.setItem(key, JSON.stringify(fallback));
      } catch {
        // Storage unavailable; keep in-memory state only
      }
    };

    const handleStorage = (event: StorageEvent) => {
      try {
        // Accessing window.localStorage can itself throw when storage is
        // denied, so the guard stays inside a try. A null key means
        // localStorage.clear() was called in another tab, which also
        // affects this entry.
        if (
          (event.key !== null && event.key !== key) ||
          event.storageArea !== window.localStorage
        ) {
          return;
        }
      } catch {
        return;
      }
      syncFromStorage();
    };
    // Subscribe before the initial sync so a write from another tab between
    // the useState initializer and this effect cannot be missed
    window.addEventListener('storage', handleStorage);
    syncFromStorage();

    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  const set = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable; state still updates for the current page view
    }
  };

  return [value, set] as const;
};
