'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FC, useCallback } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { REGIONS } from '@/lib/data';

type LocationSelectorProps = {
  initialValue?: string;
  disabled?: boolean;
};

const LocationSelector: FC<LocationSelectorProps> = ({
  initialValue,
  disabled,
}) => {
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

      const search = current.toString();
      router.push(`${pathname}${search ? `?${search}` : ''}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">Location</span>

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
    </div>
  );
};

export default LocationSelector;
