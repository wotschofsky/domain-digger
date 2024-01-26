'use client';

import {
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

const BookmarkletLink = () => {
  const [target, setTarget] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
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
    setTarget(`javascript:${minifiedScript}`);
  }, []);

  const clickHandler = useCallback<MouseEventHandler<HTMLAnchorElement>>(
    (event) => {
      event.preventDefault();
      setIsOpen(true);
    },
    [setIsOpen]
  );

  const mouseDownHandler = useCallback<
    MouseEventHandler<HTMLAnchorElement>
  >(() => {
    setActivated(true);
  }, [setActivated]);

  useEffect(() => {
    const handler = () => {
      setActivated(false);
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
      {target ? (
        <a
          className="text-center"
          href={target}
          onClick={clickHandler}
          onMouseDown={mouseDownHandler}
        >
          {activated ? 'Inspect Domain' : 'Bookmarklet'}
        </a>
      ) : (
        <span className="text-center">Loading...</span>
      )}

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

export default BookmarkletLink;
