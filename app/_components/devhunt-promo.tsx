'use client';

import { useLocalStorage } from '@uidotdev/usehooks';
import confetti from 'canvas-confetti';
import { ExternalLinkIcon, XIcon } from 'lucide-react';
import {
  type FC,
  type MouseEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const DevHuntPromo: FC = () => {
  const [confettiShown, setConfettiShown] = useLocalStorage(
    'devhunt-confetti.shown',
    false
  );
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback<MouseEventHandler<SVGSVGElement>>(
    (event) => {
      event.preventDefault();
      setDismissed(true);
    },
    [setDismissed]
  );

  useEffect(() => {
    if (confettiShown) {
      return;
    }

    setTimeout(() => {
      confetti({
        particleCount: 200,
        spread: 50,
        startVelocity: 100,
        angle: 70,
        origin: { y: 0.95, x: 0.1 },
      });
    }, 2000);
    setTimeout(() => {
      confetti({
        particleCount: 200,
        spread: 50,
        startVelocity: 100,
        angle: 55,
        origin: { y: 0.95, x: 0.1 },
      });
    }, 2200);

    setConfettiShown(true);
  }, [confettiShown, setConfettiShown]);

  if (dismissed) {
    return null;
  }

  return (
    <a
      className="fixed bottom-6 left-6 max-w-[calc(100vw-3rem)]"
      href="https://devhunt.org/tool/domain-digger"
      target="_blank"
    >
      <Alert className="group relative flex cursor-pointer items-center gap-4 p-8">
        <span className="absolute right-3 top-3 hidden h-3 w-3 group-hover:hidden sm:flex">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
        </span>

        <XIcon
          role="button"
          onClick={handleDismiss}
          className="absolute !left-[unset] !top-2 right-2 h-5 w-5 text-muted-foreground group-hover:block sm:hidden"
        />

        <span className="block !pl-0 text-4xl">🚀</span>
        <div>
          <AlertTitle>We&apos;re live on DevHunt!</AlertTitle>
          <AlertDescription>
            Join the conversation and help us reach the top of the leaderboard!{' '}
            <ExternalLinkIcon className="inline-block h-4 w-4 -translate-y-1" />
          </AlertDescription>
        </div>
      </Alert>
    </a>
  );
};

// TODO Remove once https://github.com/vercel/next.js/issues/60698 is fixed
export default DevHuntPromo;
