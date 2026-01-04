'use client';

import { useDebounce, useMeasure } from '@uidotdev/usehooks';
import { NetworkIcon, SearchIcon } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  type ChangeEventHandler,
  type FC,
  type FormEvent,
  type KeyboardEventHandler,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

import { useUserIp } from '@/app/api/user-ip/hook';
import { ClientOnly } from '@/components/client-only';
import { useAnalytics } from '@/lib/analytics';
import { EXAMPLE_DOMAINS } from '@/lib/data';
import { parseSearchInput } from '@/lib/search-parser';
import { cn, isAppleDevice } from '@/lib/utils';

import { useSearchSuggestions } from '../api/search-suggestions/hook';
import { IpDetailsModal } from './ip-details-modal';

const SUGGESTION_OWN_IP = Symbol('suggestion-own-ip');

const redactIp = (ip: string): string => {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.xxx.xxx.xxx`;
  }
  return ip;
};

const useSuggestions = (domain: string) => {
  const debouncedDomain = useDebounce(domain, 200);

  const userIp = useUserIp();
  const suggestions = useSearchSuggestions(debouncedDomain);

  if (domain) return suggestions;
  if (userIp) return [SUGGESTION_OWN_IP, ...EXAMPLE_DOMAINS] as const;
  return EXAMPLE_DOMAINS;
};

const useFirstRender = () => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, []);

  return isFirstRender;
};

enum FormStates {
  Initial,
  Submitting,
  Invalid,
}

type SearchFormProps = {
  autofocus?: boolean;
  subpage?: string;
};

export const SearchForm: FC<SearchFormProps> = (props) => {
  const isFirstRender = useFirstRender();

  const { reportEvent } = useAnalytics();

  const router = useRouter();
  const pathname = usePathname();

  const { domain: initialValue } = useParams<{ domain: string }>();
  const [domain, setDomain] = useState(initialValue ?? '');

  const userIp = useUserIp();

  useEffect(() => {
    if (initialValue) {
      setDomain(initialValue);
    }
  }, [initialValue]);

  const [state, setState] = useState<FormStates>(FormStates.Initial);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [ipDetailsOpen, setIpDetailsOpen] = useState(false);

  const [measureRef, { width: inputWidth }] = useMeasure<HTMLFormElement>();
  const inputRef = useRef<HTMLInputElement>(null);
  useHotkeys(
    isAppleDevice() ? 'meta+k' : 'ctrl+k',
    () => {
      setDomain('');
      inputRef.current?.focus();
    },
    { preventDefault: true },
    [inputRef],
  );

  const redirectUser = (domain: string) => {
    setState(FormStates.Submitting);

    let target = `/lookup/${domain}`;
    if (props.subpage) {
      target += `/${props.subpage}`;
    }

    if (pathname === target) {
      router.refresh();
      setTimeout(() => {
        setState(FormStates.Initial);
      }, 150);
      return;
    }

    router.push(target);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const domain =
      new FormData(event.currentTarget as HTMLFormElement)
        .get('domain')
        ?.toString() || '';

    const parsed = parseSearchInput(domain);

    switch (parsed.type) {
      case 'ip':
        setState(FormStates.Initial);
        setIpDetailsOpen(true);
        return;
      case 'domain':
        setState(FormStates.Initial);
        redirectUser(parsed.value);
        reportEvent('Search Form: Submit', {
          domain: parsed.value,
        });
        return;
      case 'invalid':
        setState(FormStates.Invalid);
        return;
    }
  };

  const suggestions = useSuggestions(domain);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null,
  );

  useEffect(() => {
    setSelectedSuggestion(null);
  }, [suggestions]);

  const handleSelectSuggestion = (value: typeof SUGGESTION_OWN_IP | string) => {
    setState(FormStates.Initial);
    setSuggestionsVisible(false);

    if (value === SUGGESTION_OWN_IP) {
      if (!userIp) {
        // This should never happen, since suggestions should not include this
        // option, if the IP is not loaded yet
        throw new Error('User IP is not loaded');
      }

      setDomain(userIp);
      setIpDetailsOpen(true);
      return;
    }

    setDomain(value);
    redirectUser(value);

    reportEvent('Search Form: Click Suggestion', {
      domain: value,
      isExample: !domain,
    });
  };

  const handleInput: ChangeEventHandler<HTMLInputElement> = (event) => {
    setDomain(event.currentTarget.value);
    setSelectedSuggestion(null);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!(suggestionsVisible && suggestions && suggestions.length > 0)) {
      if (event.currentTarget.value !== '') {
        setSuggestionsVisible(true);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedSuggestion((prev) => {
          if (prev === null) return 0;
          if (prev === (suggestions?.length ?? 0) - 1) return null;
          return prev + 1;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedSuggestion((prev) => {
          if (prev === null) return (suggestions?.length ?? 0) - 1;
          if (prev === 0) return null;
          return prev - 1;
        });
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (selectedSuggestion !== null) {
          event.preventDefault();
          setSelectedSuggestion(null);
        }
        break;
      case 'Enter':
        if (selectedSuggestion !== null) {
          event.preventDefault();
          handleSelectSuggestion(suggestions[selectedSuggestion]);
        }
        break;
      case 'Escape':
        setSuggestionsVisible(false);
        if (selectedSuggestion !== null) {
          setSelectedSuggestion(null);
        }
        break;
    }
  };

  const handleFocus = () => {
    // Skip the first render to avoid suggestions showing up on initial load without user interaction
    if (isFirstRender.current) return;
    setSuggestionsVisible(true);
  };

  const handleIpDetailsOpenChange = (open: boolean) => {
    setIpDetailsOpen(open);
    if (!open) {
      inputRef.current?.focus();
    }
  };

  return (
    <>
      <form ref={measureRef} className="relative" onSubmit={handleSubmit}>
        {domain === initialValue ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(initialValue)}`}
            alt=""
          />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        )}

        <Input
          ref={inputRef}
          name="domain"
          className="w-full pl-9!"
          data-invalid={state === FormStates.Invalid ? '' : undefined}
          type="text"
          required
          autoComplete="off"
          placeholder={
            (inputWidth || Infinity) >= 300
              ? 'Search any domain, URL, email or IP'
              : 'Search'
          }
          aria-label="Domain"
          enterKeyHint="go"
          value={
            selectedSuggestion !== null
              ? typeof suggestions?.[selectedSuggestion] === 'string'
                ? suggestions[selectedSuggestion]
                : domain
              : domain
          }
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onClick={handleFocus}
          onBlur={() => {
            setTimeout(() => {
              setSuggestionsVisible(false);
            }, 100);
          }}
          disabled={state === FormStates.Submitting}
          autoFocus={props.autofocus}
        />

        {state === FormStates.Submitting ? (
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col justify-center">
            <Spinner className="size-4" />
          </div>
        ) : (
          <ClientOnly>
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden h-5 -translate-y-1/2 items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex dark:border-zinc-700 dark:bg-zinc-800">
              {isAppleDevice() ? (
                <>
                  <span className="text-xs">⌘</span>K
                </>
              ) : (
                'ctrl+k'
              )}
            </kbd>
          </ClientOnly>
        )}

        {suggestionsVisible && suggestions && suggestions.length > 0 && (
          <Card className="absolute top-full left-0 z-10 h-min p-1">
            <ul>
              {suggestions.map((value, index) => {
                if (value === SUGGESTION_OWN_IP) {
                  return (
                    <li
                      key={String(value)}
                      className={cn(
                        'flex cursor-pointer items-center rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10',
                        {
                          'bg-black/5 dark:bg-white/10':
                            selectedSuggestion === index,
                        },
                      )}
                      onClick={() => handleSelectSuggestion(value)}
                    >
                      <NetworkIcon className="mr-2 inline-block size-4 text-zinc-500 dark:text-zinc-400" />
                      <span>
                        Your IP address
                        {userIp && ` (${redactIp(userIp)})`}
                      </span>
                    </li>
                  );
                }

                return (
                  <li
                    key={value}
                    className={cn(
                      'flex cursor-pointer items-center rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10',
                      {
                        'bg-black/5 dark:bg-white/10':
                          selectedSuggestion === index,
                      },
                    )}
                    onClick={() => handleSelectSuggestion(value)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="mr-2 inline-block size-4"
                      src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(value)}`}
                      alt=""
                    />
                    {value}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </form>

      <IpDetailsModal
        ip={domain.trim()}
        open={ipDetailsOpen}
        onOpenChange={handleIpDetailsOpenChange}
      />
    </>
  );
};
