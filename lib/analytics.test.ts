import { describe, expect, it, vi } from 'vitest';

import { useAnalytics } from './analytics';

const { plausible } = vi.hoisted(() => ({ plausible: vi.fn() }));
vi.mock('next-plausible', () => ({ usePlausible: () => plausible }));
vi.mock('evlog/next/client', () => ({ log: { info: vi.fn() } }));
vi.mock('react', () => ({ useCallback: (callback: unknown) => callback }));

describe('reportEvent', () => {
  it('passes interactive: false through to Plausible', () => {
    useAnalytics().reportEvent(
      'BotID: Check',
      { result: 'bot' },
      { interactive: false },
    );

    expect(plausible).toHaveBeenCalledWith('BotID: Check', {
      props: { result: 'bot' },
      interactive: false,
    });
  });
});
