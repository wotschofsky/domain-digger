import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useSafeLocalStorage } from './use-safe-local-storage';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'test.key';

const mounted: Array<() => void> = [];

const renderHook = <T>(getInitialValue: () => T) => {
  const resultRef = {
    current: null as unknown as readonly [T, (next: T) => void],
  };
  const Probe = () => {
    const hookResult = useSafeLocalStorage(KEY, getInitialValue);
    // Render-phase writes to outer variables are rejected by the React
    // Compiler lint; effects run within act(), so the capture is in time
    useEffect(() => {
      resultRef.current = hookResult;
    });
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
  mounted.push(() => act(() => root.unmount()));
  return { result: resultRef };
};

const originalLocalStorage = window.localStorage;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // Unmount before restoring localStorage so lingering storage listeners
  // from one test cannot react to events dispatched in the next
  mounted.forEach((unmount) => unmount());
  mounted.length = 0;
  Object.defineProperty(window, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  });
});

describe('useSafeLocalStorage', () => {
  it('returns the stored value when present', () => {
    window.localStorage.setItem(KEY, JSON.stringify(42));
    const { result } = renderHook(() => 0);
    expect(result.current[0]).toBe(42);
  });

  it('falls back and persists the initial value when the key is missing', () => {
    const { result } = renderHook(() => 7);
    expect(result.current[0]).toBe(7);
    expect(window.localStorage.getItem(KEY)).toBe('7');
  });

  it('repairs corrupted values instead of crashing (#92)', () => {
    window.localStorage.setItem(KEY, 'not-valid-json{');
    const { result } = renderHook(() => 'fallback');
    expect(result.current[0]).toBe('fallback');
    expect(window.localStorage.getItem(KEY)).toBe('"fallback"');
  });

  it('falls back without crashing when storage access is denied', () => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Access is denied', 'SecurityError');
      },
      configurable: true,
    });
    const { result } = renderHook(() => 'safe');
    expect(result.current[0]).toBe('safe');
  });

  it('set() updates state and persists', () => {
    const { result } = renderHook(() => false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('true');
  });

  it('syncs from storage when another tab writes', () => {
    const { result } = renderHook(() => 'initial');
    window.localStorage.setItem(KEY, JSON.stringify('from-other-tab'));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEY,
          newValue: JSON.stringify('from-other-tab'),
          storageArea: window.localStorage,
        }),
      );
    });
    expect(result.current[0]).toBe('from-other-tab');
  });

  it('reads storage as the authority, not the event payload', () => {
    const { result } = renderHook(() => 'initial');
    window.localStorage.setItem(KEY, JSON.stringify('latest'));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEY,
          newValue: JSON.stringify('stale'),
          storageArea: window.localStorage,
        }),
      );
    });
    expect(result.current[0]).toBe('latest');
  });

  it('derives and persists a fresh fallback on cross-tab clear()', () => {
    let calls = 0;
    const { result } = renderHook(() => {
      calls += 1;
      return `fallback-${calls}`;
    });
    act(() => result.current[1]('written'));
    window.localStorage.clear();
    act(() => {
      // clear() in another tab emits a storage event with a null key
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: null,
          newValue: null,
          storageArea: window.localStorage,
        }),
      );
    });
    const [value] = result.current;
    expect(value).toMatch(/^fallback-/);
    expect(value).not.toBe('written');
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(value));
  });

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => 'mine');
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'other.key',
          newValue: '"other"',
          storageArea: window.localStorage,
        }),
      );
    });
    expect(result.current[0]).toBe('mine');
  });
});
