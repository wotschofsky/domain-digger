'use client';

import { useLocalStorage } from '@uidotdev/usehooks';
import { usePlausible } from 'next-plausible';
import { usePathname } from 'next/navigation';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export const StarReminder: FC = () => {
  const plausible = usePlausible();

  const [visitsCount, setVisitsCount] = useLocalStorage(
    'star-reminder.visits',
    0
  );
  const [isStarred, setIsStarred] = useLocalStorage(
    'star-reminder.starred',
    false
  );
  const [suppressed, setSuppressed] = useState(false);

  const pathname = usePathname();
  const lastPathname = useRef('');
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      setVisitsCount((value) => value + 1);
    }
  }, [setVisitsCount, pathname]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSuppressed(true);
        plausible('Star Reminder: Suppress', {
          props: { visitsCount },
        });
      }
    },
    [setSuppressed, plausible, visitsCount]
  );

  const onClick = useCallback(() => {
    setIsStarred(true);
    plausible('Star Reminder: Click', {
      props: { visitsCount },
    });
  }, [setIsStarred, plausible, visitsCount]);

  const shouldShow = (visitsCount - 15) % 25 === 0 && !isStarred && !suppressed;

  useEffect(() => {
    if (shouldShow) {
      plausible('Star Reminder: Show', {
        props: { visitsCount },
      });
    }
  }, [shouldShow, plausible, visitsCount]);

  return (
    <AlertDialog open={shouldShow} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you enjoying Domain Digger?</AlertDialogTitle>
          <AlertDialogDescription>
            Domain Digger is 100% free and open-source without any ads. If you
            like it, please consider starring the GitHub repository!
            <div className="mt-8 flex justify-center">
              <Button variant="ghost" asChild onClick={onClick}>
                <a
                  href="https://github.com/wotschofsky/domain-digger"
                  target="_blank"
                  rel="noopener"
                >
                  <FaGithub className="mr-1 h-6 w-4" />
                  <span>Star</span>
                  <span className="sr-only">on GitHub</span>
                </a>
              </Button>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Skip</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// TODO Remove once https://github.com/vercel/next.js/issues/60698 is fixed
export default StarReminder;
