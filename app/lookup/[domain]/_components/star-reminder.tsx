'use client';

import ms from 'ms';
import { type FC, useEffect, useRef, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useStargazersSummary } from '@/app/api/stargazers-summary/hook';
import { useAnalytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const INITIAL_DELAY = ms('2m');
const TIMEOUT_PERIOD = ms('7d');
const SKIP_BUTTON_DELAY = ms('5s');

// Unlike @uidotdev/usehooks' useLocalStorage, this survives blocked storage
// access (throws SecurityError) and corrupted values (JSON.parse throws),
// both of which crashed the page during render (#92). The initial value is a
// factory so time-derived fallbacks (the reminder delay anchor) are computed
// fresh whenever they are needed, not captured at render time.
const useSafeLocalStorage = <T,>(key: string, getInitialValue: () => T) => {
  // Whether the initializer fell back (missing key, corrupt value, or
  // blocked storage) rather than reading a stored value; idempotent ref
  // write, so safe under StrictMode double-invocation
  const usedFallbackRef = useRef(false);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw);
      }
    } catch {
      // Blocked storage or corrupt value; fall through to the fallback
    }
    usedFallbackRef.current = true;
    return getInitialValue();
  });

  // The factory only closes over module constants, so the mount-time one
  // stays correct for the storage handlers below
  const getInitialValueRef = useRef(getInitialValue);
  // What the initializer produced, so the mount repair below persists the
  // exact anchor the countdown is already using
  const mountValueRef = useRef(value);

  // Match the replaced hook: persist the initial value so time-based state
  // (the reminder delay anchor) survives reloads, and follow changes made in
  // other tabs
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      try {
        // Accessing window.localStorage can itself throw when storage is
        // denied, so the guard stays inside the try. A null key means
        // localStorage.clear() was called in another tab, which also
        // affects this entry (newValue is null there too).
        if (
          (event.key !== null && event.key !== key) ||
          event.storageArea !== window.localStorage
        ) {
          return;
        }

        if (event.newValue === null) {
          const fallback = getInitialValueRef.current();
          setValue(fallback);
          // Persist like the mount path so a reload reuses this anchor
          // instead of minting a new one
          window.localStorage.setItem(key, JSON.stringify(fallback));
        } else {
          setValue(JSON.parse(event.newValue));
        }
      } catch {
        // Ignore corrupted values written by other tabs
      }
    };
    // Subscribe before reading so a write from another tab between the
    // useState initializer and this effect cannot be missed
    window.addEventListener('storage', handleStorage);

    try {
      const raw = window.localStorage.getItem(key);
      let parsed: { value: T } | null = null;
      if (raw !== null) {
        try {
          parsed = { value: JSON.parse(raw) };
        } catch {
          // Corrupted entry (the #92 scenario); replace below so the
          // fallback value persists instead of being recomputed every load
        }
      }
      if (parsed === null) {
        // If the initializer had read a valid value, another tab removed the
        // key in between — derive a fresh fallback like the storage-event
        // path instead of resurrecting the deleted value. Otherwise persist
        // the initializer's own fallback.
        const fallback = usedFallbackRef.current
          ? mountValueRef.current
          : getInitialValueRef.current();
        setValue(fallback);
        window.localStorage.setItem(key, JSON.stringify(fallback));
      } else {
        // Re-sync in case another tab wrote after the initializer ran
        setValue(parsed.value);
      }
    } catch {
      // Storage unavailable; keep in-memory state only
    }

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

export const StarReminder: FC = () => {
  const { reportEvent } = useAnalytics();
  const [_, setForceUpdate] = useState(0);
  const forceUpdate = () => setForceUpdate((prev) => prev + 1);
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(SKIP_BUTTON_DELAY / 1000),
  );

  const { data } = useStargazersSummary();

  const [isStarred, setIsStarred] = useSafeLocalStorage(
    'star-reminder.starred',
    () => false,
  );
  const [lastDismissed, setLastDismissed] = useSafeLocalStorage(
    'star-reminder.last-dismissed',
    () => Date.now() - TIMEOUT_PERIOD + INITIAL_DELAY,
  );

  const timeUntilVisible = TIMEOUT_PERIOD - (Date.now() - lastDismissed);
  const visible = Boolean(data) && timeUntilVisible <= 0 && !isStarred;

  useEffect(() => {
    if (timeUntilVisible > 0) {
      const timeout = setTimeout(() => {
        forceUpdate();
      }, timeUntilVisible + 100);
      return () => clearTimeout(timeout);
    }
  }, [timeUntilVisible]);

  useEffect(() => {
    if (visible) {
      reportEvent('Star Reminder: Show', {});
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  const handleOpenChange = (state: boolean) => {
    if (!state) {
      setLastDismissed(Date.now());
      reportEvent('Star Reminder: Suppress', {});
    }
  };

  const handleClick = () => {
    setIsStarred(true);
    window.open('https://github.com/wotschofsky/domain-digger', '_blank');
    reportEvent('Star Reminder: Click', {});
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes avatar-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!visible) {
    return null;
  }

  if (!data) {
    return null;
  }

  return (
    <AlertDialog open={visible} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-lg font-bold">
            Enjoying Domain Digger?
          </AlertDialogTitle>
          {/* asChild: the default <p> cannot contain the div/p children below */}
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="flex justify-center">
                {data.recentStargazers.map((user, index) => (
                  <img
                    key={index}
                    className="aspect-square w-8 scale-125 rounded-full border-2 border-white dark:border-zinc-900"
                    style={{
                      animationDelay: `${1 + index * 0.15}s`,
                      animationDuration: '0.5s',
                      animationName: 'avatar-bounce',
                      animationIterationCount: 1,
                      animationTimingFunction: 'ease-in-out',
                    }}
                    src={user.avatarUrl}
                    alt={`${user.name}'s avatar`}
                  />
                ))}
              </div>
              <p className="text-center">
                {data.recentStargazers[0].name} and {data.totalStars - 1} others
                <br />
                have recently starred Domain Digger
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogAction onClick={handleClick}>
          <FaGithub className="mr-1 h-6 w-4" />
          Star on GitHub
        </AlertDialogAction>

        <AlertDialogDescription className="text-center text-sm">
          Starring the project is 100% free and helps spread the word
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={secondsRemaining > 0}
            className={cn(
              secondsRemaining > 0 && 'cursor-not-allowed opacity-50',
            )}
          >
            {secondsRemaining > 0 ? `Skip (${secondsRemaining}s)` : 'Skip'}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
