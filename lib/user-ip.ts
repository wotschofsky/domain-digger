import { useState } from 'react';
import useSWRImmutable from 'swr/immutable';
import isIP from 'validator/lib/isIP';

import { useAnalytics } from './analytics';

export type IpVersion = 4 | 6;

export type IpProvider = 'icanhazip' | 'ident.me';

export const ipEndpoint = (version: IpVersion, provider: IpProvider) =>
  provider === 'icanhazip'
    ? `https://ipv${version}.icanhazip.com/`
    : `https://${version}.ident.me/`;

export const fetchUserIp = async (
  version: IpVersion,
  provider: IpProvider = 'icanhazip',
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException('IP detection timed out', 'TimeoutError'),
      ),
    3000,
  );

  try {
    // This must run in the visitor's browser, never through a server proxy.
    const response = await fetch(ipEndpoint(version, provider), {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('IP detection failed');
    const ip = (await response.text()).trim();
    if (!isIP(ip, version)) throw new Error('Invalid IP response');
    return ip;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const useUserIp = (version: IpVersion, enabled: boolean) => {
  const { reportEvent } = useAnalytics();
  const [provider, setProvider] = useState<IpProvider>('icanhazip');

  const result = useSWRImmutable<string, Error>(
    enabled ? ipEndpoint(version, provider) : null,
    () => fetchUserIp(version, provider),
    {
      shouldRetryOnError: false,
      onSuccess: () =>
        reportEvent('My IP: Detection', {
          version,
          provider,
          result: 'detected',
        }),
      onError: (error) =>
        reportEvent('My IP: Detection', {
          version,
          provider,
          result: error.name === 'TimeoutError' ? 'timeout' : 'error',
        }),
    },
  );
  return { ...result, provider, tryAlternative: () => setProvider('ident.me') };
};

// Subscribe to cached detections without starting a request, even when a global
// SWR fetcher is configured. The search suggestion is a preview, not a probe.
export const useCachedUserIp = (version: IpVersion) => {
  const options = {
    revalidateOnMount: false,
    isPaused: () => true,
  };
  const primary = useSWRImmutable<string>(
    ipEndpoint(version, 'icanhazip'),
    options,
  );
  const alternative = useSWRImmutable<string>(
    ipEndpoint(version, 'ident.me'),
    options,
  );
  return primary.data ?? alternative.data;
};
