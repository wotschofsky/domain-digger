import useSWRImmutable from 'swr/immutable';
import isIP from 'validator/lib/isIP';

import { useAnalytics } from './analytics';

export type IpVersion = 4 | 6;

export const fetchUserIp = async (version: IpVersion): Promise<string> => {
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
    const response = await fetch(`https://${version}.ident.me/`, {
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

  return useSWRImmutable<string, Error>(
    enabled ? `https://${version}.ident.me/` : null,
    () => fetchUserIp(version),
    {
      shouldRetryOnError: false,
      onSuccess: () =>
        reportEvent('My IP: Detection', { version, result: 'detected' }),
      onError: (error) =>
        reportEvent('My IP: Detection', {
          version,
          result: error.name === 'TimeoutError' ? 'timeout' : 'error',
        }),
    },
  );
};
