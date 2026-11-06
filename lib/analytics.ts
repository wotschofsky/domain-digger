import { log } from 'evlog/next/client';
import { usePlausible } from 'next-plausible';
import { useCallback } from 'react';

type EmptyEvent = Record<string, never>;

type Events = {
  'BotID: Check': { result: 'human' | 'bot' | 'error' };
  'Carbon Ad: Blocked': { reason: 'script' | 'no-ad' };
  'Carbon Ad: Show': EmptyEvent;
  'Copy Button: Click': { value: string };
  'IP Details: Open': { ip: string };
  'Location Selector: Change': { location: string };
  'My IP: Open': EmptyEvent;
  'Outbound Link: Click': { url: string };
  'Resolver Selector: Change': { resolver: string };
  'Search Form: Click Suggestion': { domain: string; isExample: boolean };
  'Search Form: Submit': { domain: string };
  'Share: Click': { url: string };
  'Star Reminder: Click': EmptyEvent;
  'Star Reminder: Show': EmptyEvent;
  'Star Reminder: Suppress': EmptyEvent;
  'Trace: Click': { type: string; domain: string };
};

export const useAnalytics = () => {
  const plausible = usePlausible();

  // Stable so it can sit in effect dependencies
  const reportEvent = useCallback(
    <T extends keyof Events>(
      event: T,
      props: Events[T],
      // interactive: false keeps an event from counting against bounce rate
      options?: { interactive?: boolean },
    ) => {
      log.info({ message: 'analytics_event', event, props });
      plausible(event, { props, ...options });
    },
    [plausible],
  );

  return {
    reportEvent,
  };
};
