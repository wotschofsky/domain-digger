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
import { REGIONS } from '@/lib/data';

type LocationSelectorProps = {
  initialValue?: string;
  disabled?: boolean;
};

export const LocationSelector: FC<LocationSelectorProps> = ({
  initialValue,
  disabled,
}) => {
  const { reportEvent } = useAnalytics();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onValueChange = useCallback(
    (value: string) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      if (!value || value === 'auto') {
        current.delete('location');
      } else {
        current.set('location', value);
      }

      const search = current.size ? `?${current.toString()}` : '';
      router.push(`${pathname}${search}`);

      reportEvent('Location Selector: Change', { location: value });
    },
    [router, pathname, searchParams, reportEvent],
  );

  return (
    <Label className="flex flex-col gap-1">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">Location</span>

      <Select
        defaultValue={initialValue || 'auto'}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          {Object.entries(REGIONS).map(([id, details]) => (
            <SelectItem key={id} value={id}>
              {details.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Label>
  );
};
