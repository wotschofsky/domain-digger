'use client';

import { useLocalStorage } from '@uidotdev/usehooks';
import { XIcon } from 'lucide-react';
import ms from 'ms';
import { type FC, useCallback, useEffect, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useAnalytics } from '@/lib/analytics';

const INITIAL_DELAY = ms('2m');
const TIMEOUT_PERIOD = ms('7d');

export const StarReminder: FC = () => {
  const { reportEvent } = useAnalytics();
  const [_, setForceUpdate] = useState(0);

  const [isStarred, setIsStarred] = useLocalStorage(
    'star-reminder.starred',
    false,
  );
  const [lastDismissed, setLastDismissed] = useLocalStorage(
    'star-reminder.last-dismissed',
    Date.now() - TIMEOUT_PERIOD + INITIAL_DELAY,
  );

  const timeUntilVisible = TIMEOUT_PERIOD - (Date.now() - lastDismissed);
  const visible = timeUntilVisible <= 0 && !isStarred;

  useEffect(() => {
    if (timeUntilVisible > 0) {
      const timeout = setTimeout(() => {
        setForceUpdate((prev) => prev + 1);
      }, timeUntilVisible + 100);
      return () => clearTimeout(timeout);
    }
  }, [timeUntilVisible]);

  const handleDismiss = useCallback(() => {
    setLastDismissed(Date.now());
    reportEvent('Star Reminder: Suppress', {});
  }, [setLastDismissed, reportEvent]);

  const handleClick = useCallback(() => {
    setIsStarred(true);
    reportEvent('Star Reminder: Click', {});
  }, [setIsStarred, reportEvent]);

  if (!visible) {
    return null;
  }

  return (
    <aside className="fixed bottom-6 left-6 max-w-[calc(100vw-3rem)]">
      <Card className="relative p-6 shadow-lg">
        <p className="!pl-0 font-semibold">
          Enjoying Domain Digger?{' '}
          <XIcon
            role="button"
            onClick={handleDismiss}
            className="ml-3 inline-block h-5 w-5 text-zinc-500 dark:text-zinc-400"
          />
        </p>
        <div className="mt-4 flex select-none justify-evenly !pl-0">
          <Button
            variant="ghost"
            asChild
            className="px-2"
            onClick={handleClick}
          >
            <a
              href="https://github.com/wotschofsky/domain-digger"
              target="_blank"
              rel="noopener"
            >
              <FaGithub className="mr-1 h-6 w-4" />
              <span className="hidden md:inline">
                Star <span className="sr-only">on GitHub</span>
              </span>
            </a>
          </Button>
        </div>
      </Card>
    </aside>
  );
};
