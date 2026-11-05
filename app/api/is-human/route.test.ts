import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const { checkBotId } = vi.hoisted(() => ({ checkBotId: vi.fn() }));
vi.mock('botid/server', () => ({ checkBotId }));
vi.mock('@/lib/evlog', () => ({
  useLogger: () => ({ set: vi.fn() }),
  withEvlog: (handler: unknown) => handler,
}));

describe('is-human API', () => {
  it.each([
    ['a human', { isHuman: true, bypassed: false }, true],
    ['a bot', { isHuman: false, bypassed: false }, false],
    ['a bypassed check', { isHuman: true, bypassed: true }, false],
  ])('answers %s with isHuman %s', async (_, verdict, isHuman) => {
    checkBotId.mockResolvedValue(verdict);

    const response = await POST();

    expect(await response.json()).toEqual({ isHuman });
  });
});
