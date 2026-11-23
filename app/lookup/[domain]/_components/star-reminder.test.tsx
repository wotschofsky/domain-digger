import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { StarReminder } from './star-reminder';

const reportEvent = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/stargazers-summary/hook', () => ({
  useStargazersSummary: () => ({
    data: { recentStargazers: [], totalStars: 0 },
  }),
}));
vi.mock('@/lib/analytics', () => ({
  useAnalytics: () => ({ reportEvent }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  reportEvent.mockClear();
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const getDialog = () => document.querySelector('[role="alertdialog"]');

it('keeps the initial deadline across remounts and waits after dismissal', async () => {
  await act(async () => root.render(<StarReminder />));
  await advance(90_000);
  expect(getDialog()).toBeNull();

  await act(async () => root.render(null));
  await act(async () => root.render(<StarReminder />));
  await advance(30_100);
  expect(getDialog()).not.toBeNull();
  expect(reportEvent.mock.calls).toEqual([['Star Reminder: Show', {}]]);

  await advance(5_000);
  const skip = Array.from(
    getDialog()!.querySelectorAll<HTMLButtonElement>('button'),
  ).find((button) => button.textContent === 'Skip')!;
  await act(async () => skip.click());
  expect(getDialog()).toBeNull();
  expect(reportEvent).toHaveBeenLastCalledWith('Star Reminder: Suppress', {});

  await advance(24 * 60 * 60 * 1000);
  expect(getDialog()).toBeNull();
});
