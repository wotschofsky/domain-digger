import posthog from 'posthog-js';

import { env } from '@/env';

let initialized = false;
const consentListeners = new Set<() => void>();

export const subscribePostHogConsent = (listener: () => void) => {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
};

export const initializePostHog = () => {
  if (initialized) return true;
  if (
    typeof window === 'undefined' ||
    process.env.NODE_ENV !== 'production' ||
    !env.NEXT_PUBLIC_POSTHOG_KEY
  ) {
    return false;
  }

  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'never',
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: false,
    capture_exceptions: false,
    advanced_disable_feature_flags: true,
    disable_surveys: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
    },
  });
  initialized = true;
  consentListeners.forEach((listener) => listener());
  return true;
};

export const getPostHogConsent = () => {
  if (!initialized) return 'unavailable';
  const consent = posthog.get_explicit_consent_status();
  if (consent === 'granted') return 'accepted';
  if (consent === 'denied') return 'declined';
  return 'pending';
};

export const setPostHogConsent = (accepted: boolean) => {
  if (!initialized) return;
  if (accepted) {
    if (getPostHogConsent() === 'accepted') return;
    posthog.opt_in_capturing();
    posthog.capture('$pageview');
  } else {
    posthog.opt_out_capturing();
  }
  consentListeners.forEach((listener) => listener());
};

export const capturePostHogEvent = (
  event: string,
  properties: Record<string, unknown>,
) => {
  if (getPostHogConsent() !== 'accepted') return;
  posthog.capture(event, properties);
};
