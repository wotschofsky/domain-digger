'use client';

import { useLocalStorage } from '@uidotdev/usehooks';
import ms from 'ms';
import { type FC, useEffect, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useStargazersSummary } from '@/app/api/stargazers-summary/hook';
import { useAnalytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const INITIAL_DELAY = ms('2m');
const TIMEOUT_PERIOD = ms('7d');
const SKIP_BUTTON_DELAY = ms('5s');

export const StarReminder: FC = () => {
  const { reportEvent } = useAnalytics();
  const [_, setForceUpdate] = useState(0);
  const forceUpdate = () => setForceUpdate((prev) => prev + 1);
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(SKIP_BUTTON_DELAY / 1000),
  );

  const { data } = useStargazersSummary();

  const [isStarred, setIsStarred] = useLocalStorage(
    'star-reminder.starred',
    false,
  );
  const [lastDismissed, setLastDismissed] = useLocalStorage(
    'star-reminder.last-dismissed',
    Date.now() - TIMEOUT_PERIOD + INITIAL_DELAY,
  );

  const timeUntilVisible = TIMEOUT_PERIOD - (Date.now() - lastDismissed);
  const visible = Boolean(data) && timeUntilVisible <= 0 && !isStarred;

  useEffect(() => {
    if (timeUntilVisible > 0) {
      const timeout = setTimeout(() => {
        forceUpdate();
      }, timeUntilVisible + 100);
      return () => clearTimeout(timeout);
    }
  }, [timeUntilVisible]);

  useEffect(() => {
    if (visible) {
      reportEvent('Star Reminder: Show', {});
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  const handleOpenChange = (state: boolean) => {
    if (!state) {
      setLastDismissed(Date.now());
      reportEvent('Star Reminder: Suppress', {});
    }
  };

  const handleClick = () => {
    setIsStarred(true);
    window.open('https://github.com/wotschofsky/domain-digger', '_blank');
    reportEvent('Star Reminder: Click', {});
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes avatar-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!visible) {
    return null;
  }

  if (!data) {
    return null;
  }

  return (
    <AlertDialog open={visible} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-lg font-bold">
            Enjoying Domain Digger?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4">
              <div className="flex justify-center">
                {data.recentStargazers.map((user, index) => (
                  <img
                    key={index}
                    className="aspect-square w-8 scale-125 rounded-full border-2 border-white dark:border-zinc-900"
                    style={{
                      animationDelay: `${1 + index * 0.15}s`,
                      animationDuration: '0.5s',
                      animationName: 'avatar-bounce',
                      animationIterationCount: 1,
                      animationTimingFunction: 'ease-in-out',
                    }}
                    src={user.avatarUrl}
                    alt={`${user.name}'s avatar`}
                  />
                ))}
              </div>
              <p className="text-center">
                {data.recentStargazers[0].name} and {data.totalStars - 1} others
                <br />
                have recently starred Domain Digger
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogAction onClick={handleClick}>
          <FaGithub className="mr-1 h-6 w-4" />
          Star on GitHub
        </AlertDialogAction>

        <AlertDialogDescription className="text-center text-sm">
          Starring the project is 100% free and helps spread the word
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={secondsRemaining > 0}
            className={cn(
              secondsRemaining > 0 && 'cursor-not-allowed opacity-50',
            )}
          >
            {secondsRemaining > 0 ? `Skip (${secondsRemaining}s)` : 'Skip'}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
