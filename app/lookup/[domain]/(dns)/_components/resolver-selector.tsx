'use client';

import { Label } from '@radix-ui/react-label';
import { usePlausible } from 'next-plausible';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FC, useCallback } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ResolverSelectorProps = {
  initialValue?: string;
};

export const ResolverSelector: FC<ResolverSelectorProps> = ({
  initialValue,
}) => {
  const plausible = usePlausible();

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

      plausible('Resolver Selector: Change', {
        props: { resolver: value },
      });
    },
    [router, pathname, searchParams, plausible],
  );

  return (
    <Label className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">Resolver</span>

      <Select
        defaultValue={initialValue || 'authoritative'}
        onValueChange={onValueChange}
      >
        <SelectTrigger className="w-[180px]">
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
