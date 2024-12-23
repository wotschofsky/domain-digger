'use client';

import { Label } from '@radix-ui/react-label';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FC, useCallback } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAnalytics } from '@/lib/analytics';

type ResolverSelectorProps = {
  initialValue?: string;
};

export const ResolverSelector: FC<ResolverSelectorProps> = ({
  initialValue,
}) => {
  const { reportEvent } = useAnalytics();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onValueChange = useCallback(
    (value: string) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      if (!value || value === 'authoritative') {
        current.delete('resolver');
      } else {
        current.set('resolver', value);
      }

      const search = current.size ? `?${current.toString()}` : '';
      router.push(`${pathname}${search}`);

      reportEvent('Resolver Selector: Change', { resolver: value });
    },
    [router, pathname, searchParams, reportEvent],
  );

  return (
    <Label className="flex flex-col gap-1">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">Resolver</span>

      <Select
        defaultValue={initialValue || 'authoritative'}
        onValueChange={onValueChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Resolver" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="authoritative">Authoritative</SelectItem>
          <SelectItem value="alibaba">Alibaba</SelectItem>
          <SelectItem value="cloudflare">Cloudflare</SelectItem>
          <SelectItem value="google">Google</SelectItem>
        </SelectContent>
      </Select>
    </Label>
  );
};
