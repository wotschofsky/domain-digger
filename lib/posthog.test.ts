import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { posthog, env } = vi.hoisted(() => ({
  posthog: {
    init: vi.fn(),
    capture: vi.fn(),
    get_explicit_consent_status: vi.fn(() => 'pending'),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
  },
}));

vi.mock('posthog-js', () => ({ default: posthog }));
vi.mock('@/env', () => ({ env }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
  posthog.get_explicit_consent_status.mockReturnValue('pending');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PostHog trial', () => {
  it('does not initialize without a project key or during development', async () => {
    const analytics = await import('./posthog');
    env.NEXT_PUBLIC_POSTHOG_KEY = '';
    expect(analytics.initializePostHog()).toBe(false);
    env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    vi.stubEnv('NODE_ENV', 'development');
    expect(analytics.initializePostHog()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(analytics.getPostHogConsent()).toBe('unavailable');
  });

  it('initializes once, with SPA pageviews, opt-in tracking and masked replay', async () => {
    const analytics = await import('./posthog');
    analytics.initializePostHog();
    analytics.initializePostHog();
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
        person_profiles: 'never',
        capture_pageview: 'history_change',
        autocapture: false,
        session_recording: { maskAllInputs: true, maskTextSelector: '*' },
      }),
    );
  });

  it('only forwards events after explicit consent, and stops after withdrawal', async () => {
    const analytics = await import('./posthog');
    analytics.initializePostHog();
    analytics.capturePostHogEvent('Search Form: Submit', {
      domain: 'example.com',
    });
    expect(posthog.capture).not.toHaveBeenCalled();

    analytics.setPostHogConsent(true);
    expect(posthog.opt_in_capturing).toHaveBeenCalledOnce();
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');

    posthog.get_explicit_consent_status.mockReturnValue('granted');
    analytics.capturePostHogEvent('Search Form: Submit', {
      domain: 'example.com',
    });
    expect(posthog.capture).toHaveBeenLastCalledWith('Search Form: Submit', {
      domain: 'example.com',
    });

    analytics.setPostHogConsent(false);
    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce();
    posthog.get_explicit_consent_status.mockReturnValue('denied');
    posthog.capture.mockClear();
    analytics.capturePostHogEvent('Copy Button: Click', {
      value: 'example.com',
    });
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
