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

type ProviderSelectorProps = {
  initialValue?: string;
};

const ProviderSelector: FC<ProviderSelectorProps> = ({ initialValue }) => {
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

type LocationSelectorProps = {
  initialValue?: string;
  disabled?: boolean;
};

const LocationSelector: FC<LocationSelectorProps> = ({
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
        <SelectTrigger>
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

export const ResolverSelector: FC = () => {
  const searchParams = useSearchParams();

  const resolverName = searchParams.get('resolver') ?? undefined;
  const locationName = searchParams.get('location') ?? undefined;

  return (
    <div className="flex flex-col gap-4 min-[450px]:flex-row">
      <div className="w-full flex-1 min-[450px]:max-w-52">
        <ProviderSelector initialValue={resolverName} />
      </div>
      <div className="w-full flex-1 min-[450px]:max-w-52">
        <LocationSelector
          initialValue={locationName}
          disabled={!resolverName}
        />
      </div>
    </div>
  );
};
