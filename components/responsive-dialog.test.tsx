import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { ResponsiveDialog } from './responsive-dialog';

it('focuses the dialog itself on open instead of its first control', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <ResponsiveDialog
        open
        onOpenChange={() => {}}
        title="Title"
        description="Description"
      >
        <button type="button">Copy value</button>
      </ResponsiveDialog>,
    ),
  );
  expect(document.activeElement?.getAttribute('role')).toBe('dialog');
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
