'use client';

import {
  type FC,
  type MouseEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const BookmarkletLink: FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

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

  const mouseDownHandler = useCallback<
    MouseEventHandler<HTMLAnchorElement>
  >(() => {
    setPressed(true);
  }, [setPressed]);

  useEffect(() => {
    const handler = () => {
      setPressed(false);
    };

    window.addEventListener('mouseup', handler);
    window.addEventListener('dragend', handler);

    return () => {
      window.removeEventListener('mouseup', handler);
      window.removeEventListener('dragend', handler);
    };
  });

  return (
    <>
      <a
        ref={applyScript}
        className="cursor-pointer text-center"
        onClick={clickHandler}
        onMouseDown={mouseDownHandler}
        tabIndex={-1}
      >
        {pressed ? 'Inspect Domain' : 'Bookmarklet'}
      </a>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Installation required</AlertDialogTitle>
            <AlertDialogDescription>
              This link is a bookmarklet intended to be dragged into your
              browser&apos;s bookmark bar. It can be clicked from anywhere to
              open the results page for the site you are currently on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ok</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
