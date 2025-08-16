'use client';

import { BookmarkIcon, DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { type FC, type MouseEventHandler, useCallback, useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export const BookmarkletLink: FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const applyScript = useCallback((element: HTMLAnchorElement | null) => {
    if (!element) return;

    const rawScript = `
      (function(){
        var tab = window.open('${location.origin}/lookup/'+location.hostname+'?ref=bookmarklet', '_blank');
        if (!tab) {
          alert('Could not open results in new tab!');
          return;
        }
        tab.focus();
      })();
    `;
    const minifiedScript = rawScript
      .split('\n')
      .map((line) => line.trim())
      .join('');

    element.href = `javascript:${minifiedScript}`;
  }, []);

  const clickHandler = useCallback<MouseEventHandler<HTMLAnchorElement>>(
    (event) => {
      event.preventDefault();
      setIsOpen(true);
    },
    [setIsOpen],
  );

  return (
    <>
      <a
        className="cursor-pointer text-center"
        onClick={clickHandler}
        tabIndex={-1}
      >
        Shortcuts
      </a>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <BookmarkIcon className="size-4" />
                <h3 className="font-semibold">Bookmarklet</h3>
              </div>
              <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                Drag the link below to your bookmarks bar. When clicked on any
                site, it opens Domain Digger results for the current domain in a
                new tab.
              </p>
              <Button
                asChild
                className="bg-background hover:bg-muted/50 inline-flex cursor-grab items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors active:cursor-grabbing"
                draggable
              >
                <a ref={applyScript}>
                  <BookmarkIcon className="size-3" />
                  Inspect Domain
                </a>
              </Button>
            </section>

            <hr className="border-border" />

            <section>
              <div className="mb-3 flex items-center gap-2">
                <DownloadIcon className="size-4" />
                <h3 className="font-semibold">Raycast Quicklink</h3>
              </div>
              <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                If you use Raycast, add a Quicklink to search domains with a
                keyboard shortcut.
              </p>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    1. Download:
                  </span>{' '}
                  <a
                    className="underline decoration-dotted underline-offset-4"
                    href="/assets/shortcuts/raycast.json"
                    download
                  >
                    raycast.json
                  </a>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">2.</span>{' '}
                  In Raycast → <strong>Quicklinks</strong> →{' '}
                  <strong>Import</strong>, choose the downloaded file
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">3.</span>{' '}
                  Trigger Raycast and type &quot;Domain Digger&quot;
                </div>
                <div className="pt-1">
                  <a
                    className="inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-4"
                    href="https://www.raycast.com/core-features/quicklinks"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Learn more about Quicklinks
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
              </div>
            </section>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
