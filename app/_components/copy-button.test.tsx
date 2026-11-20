import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyButton } from './copy-button';

const { reportEvent, toast } = vi.hoisted(() => ({
  reportEvent: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock('@/lib/analytics', () => ({ useAnalytics: () => ({ reportEvent }) }));
vi.mock('sonner', () => ({ toast }));

describe('copy button', () => {
  let root: Root;
  let container: HTMLDivElement;
  const writeText = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);
    writeText.mockReset();
    reportEvent.mockReset();
    toast.mockClear();
    toast.error.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const render = async (value: string) => {
    await act(async () => root.render(<CopyButton value={value} />));
    return container.querySelector<HTMLButtonElement>('button')!;
  };

  it('waits for the clipboard, preserves focus, and reports the copied value', async () => {
    let finishCopy!: () => void;
    writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishCopy = resolve;
        }),
    );
    const button = await render('2001:db8::1');
    await act(async () => {
      button.focus();
      button.click();
    });
    expect(button.getAttribute('aria-label')).toBe('Copy value');
    expect(toast).not.toHaveBeenCalled();
    await act(async () => finishCopy());
    expect(writeText).toHaveBeenCalledWith('2001:db8::1');
    expect(button.getAttribute('aria-label')).toBe('Copied');
    expect(document.activeElement).toBe(button);
    expect(toast).toHaveBeenCalledWith('Copied to clipboard');
    expect(reportEvent).toHaveBeenCalledWith('Copy Button: Click', {
      value: '2001:db8::1',
    });
  });

  it('shows a failure without reporting a successful copy', async () => {
    writeText.mockRejectedValue(new Error('Clipboard denied'));
    const button = await render('192.0.2.1');
    await act(async () => button.click());
    expect(button.getAttribute('aria-label')).toBe('Copy value');
    expect(toast.error).toHaveBeenCalledWith('Could not copy to clipboard');
    expect(toast).not.toHaveBeenCalled();
    expect(reportEvent).not.toHaveBeenCalled();
  });

  it('resets feedback for a new value and after the latest copy', async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    const button = await render('192.0.2.1');
    await act(async () => button.click());
    await act(async () => vi.advanceTimersByTime(1500));
    await render('2001:db8::1');
    expect(button.getAttribute('aria-label')).toBe('Copy value');
    await act(async () => button.click());
    await act(async () => vi.advanceTimersByTime(500));
    expect(button.getAttribute('aria-label')).toBe('Copied');
    await act(async () => vi.advanceTimersByTime(1500));
    expect(button.getAttribute('aria-label')).toBe('Copy value');
  });
});
