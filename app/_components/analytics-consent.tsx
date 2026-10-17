'use client';

import { type FC, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';

import {
  getPostHogConsent,
  setPostHogConsent,
  subscribePostHogConsent,
} from '@/lib/posthog';

const getServerConsent = () => 'unavailable' as const;

export const AnalyticsConsent: FC = () => {
  const consent = useSyncExternalStore(
    subscribePostHogConsent,
    getPostHogConsent,
    getServerConsent,
  );
  const [open, setOpen] = useState(false);
  const showPreferences = open || consent === 'pending';

  const choose = (accepted: boolean) => {
    setPostHogConsent(accepted);
    setOpen(false);
  };

  if (consent === 'unavailable') return null;

  return (
    <>
      <button
        type="button"
        className="text-sm underline decoration-dotted underline-offset-4"
        onClick={() => setOpen(true)}
        aria-expanded={showPreferences}
        aria-controls="analytics-preferences"
      >
        Analytics preferences
      </button>
      {showPreferences && (
        <section
          id="analytics-preferences"
          aria-labelledby="analytics-preferences-title"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <h2 id="analytics-preferences-title" className="font-semibold">
            Help improve Domain Digger
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Allow optional PostHog analytics to understand feature usage and
            record visits with text and inputs masked. This uses cookies. You
            can change your choice here at any time.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => choose(false)}>
              Decline
            </Button>
            <Button variant="secondary" onClick={() => choose(true)}>
              Allow analytics
            </Button>
          </div>
        </section>
      )}
    </>
  );
};
