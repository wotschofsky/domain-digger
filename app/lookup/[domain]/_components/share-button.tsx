'use client';

import { Share2Icon } from 'lucide-react';
import { type FC, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { useAnalytics } from '@/lib/analytics';

export const ShareButton: FC = () => {
  const { reportEvent } = useAnalytics();

  const onClick = useCallback(() => {
    reportEvent('Share: Click', {
      url: window.location.pathname + window.location.search,
    });

    if ('share' in navigator) {
      navigator.share({
        title: document.title,
        url: window.location.href,
      });
    } else {
      (navigator as Navigator).clipboard.writeText(window.location.href);
      toast('Copied to clipboard');
    }
  }, [reportEvent]);

  return (
    <Button
      className="px-3"
      variant="outline"
      size="lg"
      onClick={onClick}
      aria-label="Share"
    >
      <Share2Icon />
    </Button>
  );
};
