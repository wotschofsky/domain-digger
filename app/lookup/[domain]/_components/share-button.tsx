'use client';

import { Share2Icon } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { type FC, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export const ShareButton: FC = () => {
  const plausible = usePlausible();

  const onClick = useCallback(() => {
    if ('share' in navigator) {
      navigator.share({
        title: document.title,
        url: window.location.href,
      });
      return;
    } else {
      (navigator as Navigator).clipboard.writeText(window.location.href);
      toast('Copied to clipboard');
    }

    plausible('Share: Click', {
      props: { url: window.location.pathname + window.location.search },
    });
  }, [plausible]);

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
