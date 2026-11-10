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

export const IP_VERSIONS = [4, 6] as const;

type DetectionResult =
  | { status: 'detected'; provider: IpProvider; ip: string }
  | { status: 'checking'; provider: IpProvider }
  | { status: 'error' | 'timeout'; provider: IpProvider; error: Error };

export type IpDetection = {
  data: string | undefined;
  error: Error | undefined;
  provider: IpProvider;
  isValidating: boolean;
  retry: () => Promise<void>;
  tryAlternative: () => Promise<void>;
};

// The preview and dialog share one result per family, including the chosen
// provider and failures. Only explicit retries may contact another provider.
export const useUserIp = (
  version: IpVersion,
  enabled: boolean,
): IpDetection => {
  const { reportEvent } = useAnalytics();
  const key = `user-ip:${version}`;
  const cached = useSWRImmutable<DetectionResult>(key, {
    revalidateOnMount: false,
    isPaused: () => true,
  });
  const detect = async (provider: IpProvider): Promise<DetectionResult> => {
    let result: DetectionResult;
    try {
      result = {
        status: 'detected',
        provider,
        ip: await fetchUserIp(version, provider),
      };
    } catch (cause) {
      const error =
        cause instanceof Error
          ? cause
          : new Error('IP detection failed', { cause });
      result = {
        status: error.name === 'TimeoutError' ? 'timeout' : 'error',
        provider,
        error,
      };
    }
    reportEvent('My IP: Detection', {
      version,
      provider,
      result: result.status,
    });
    return result;
  };
  const request = useSWRImmutable(
    enabled ? key : null,
    () => detect('icanhazip'),
    { shouldRetryOnError: false },
  );
  const result = request.data ?? cached.data;
  const retry = async (provider: IpProvider) => {
    await cached.mutate(detect(provider), {
      optimisticData: { status: 'checking', provider },
      revalidate: false,
    });
  };
  return {
    data: result?.status === 'detected' ? result.ip : undefined,
    error:
      result?.status === 'error' || result?.status === 'timeout'
        ? result.error
        : undefined,
    provider: result?.provider ?? 'icanhazip',
    isValidating: request.isValidating || result?.status === 'checking',
    retry: () => retry(result?.provider ?? 'icanhazip'),
    tryAlternative: () => retry('ident.me'),
  };
};
