import useSWRImmutable from 'swr/immutable';

import {
  isUserFacingErrorPayload,
  UserFacingError,
} from '@/lib/user-facing-error';

import type { IpLookupResponse } from './route';

const fetchIpDetails = async (url: string): Promise<IpLookupResponse> => {
  const response = await fetch(url);
  const body: unknown = await response.json();
  if (!response.ok || isUserFacingErrorPayload(body)) {
    throw new UserFacingError(
      isUserFacingErrorPayload(body)
        ? body
        : {
            title: "Couldn't look up this IP address",
            description: 'The lookup did not complete. Please try again.',
            retryable: true,
          },
    );
  }
  return body as IpLookupResponse;
};

export const useIpDetails = (ip: string) =>
  useSWRImmutable(
    `/api/ip-details?ip=${encodeURIComponent(ip)}`,
    fetchIpDetails,
    // Reopening retries; automatic retries only burn the provider's rate limit.
    { shouldRetryOnError: false },
  );
