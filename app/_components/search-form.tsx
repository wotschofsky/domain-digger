'use client';

import { useDebounce, useMeasure } from '@uidotdev/usehooks';
import { SearchIcon } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { toASCII } from 'punycode';
import {
  type ChangeEventHandler,
  type FC,
  type FormEvent,
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import useSWRImmutable from 'swr/immutable';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { ClientOnly } from '@/components/client-only';
import { EXAMPLE_DOMAINS } from '@/lib/data';
import {
  cn,
  IPV4_REGEX,
  IPV6_REGEX,
  isAppleDevice,
  isValidDomain,
} from '@/lib/utils';

import { IpDetailsModal } from '../lookup/[domain]/_components/ip-details-modal';

const normalizeDomain = (input: string) => {
  let tDomain;
  try {
    tDomain = new URL(input.trim().toLowerCase()).hostname;
  } catch (err) {
    tDomain = input.trim().toLowerCase();
  }

  const normalizedDomain = tDomain.endsWith('.')
    ? tDomain.slice(0, -1)
    : tDomain;
  return toASCII(normalizedDomain);
};

const parseSearchInput = (input: string) => {
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return {
      type: 'empty',
    } as const;
  }

  if (trimmedInput.match(IPV4_REGEX) || trimmedInput.match(IPV6_REGEX)) {
    return {
      type: 'ip',
      value: trimmedInput,
    } as const;
  }

  const normalizedDomain = normalizeDomain(trimmedInput);
  if (isValidDomain(normalizedDomain)) {
    return {
      type: 'domain',
      value: normalizedDomain,
    } as const;
  }

  if (trimmedInput.includes('@')) {
    return parseSearchInput(trimmedInput.split('@').pop()!);
  }

  return {
    type: 'invalid',
  } as const;
};

const useSuggestions = (domain: string) => {
  const debouncedDomain = useDebounce(domain, 200);

  const { data: suggestions } = useSWRImmutable<string[]>(
    domain
      ? `/api/search-suggestions?q=${encodeURIComponent(debouncedDomain.toLowerCase())}`
      : null,
    { keepPreviousData: true },
  );

  return {
    suggestions: domain ? suggestions : EXAMPLE_DOMAINS,
  };
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
  Success,
}

type SearchFormProps = {
  autofocus?: boolean;
  subpage?: string;
};

export const SearchForm: FC<SearchFormProps> = (props) => {
  const isFirstRender = useFirstRender();

  const plausible = usePlausible();

  const router = useRouter();
  const pathname = usePathname();

  const { domain: initialValue } = useParams<{ domain: string }>();
  const [domain, setDomain] = useState(initialValue ?? '');

  useEffect(() => {
    if (initialValue) {
      setDomain(initialValue);
    }
  }, [initialValue]);

  const [state, setState] = useState<FormStates>(FormStates.Initial);
  const [isInvalid, setInvalid] = useState(false);
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

  const redirectUser = useCallback(
    (domain: string) => {
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
    },
    [setState, router, pathname, props.subpage],
  );

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const domain =
        new FormData(event.currentTarget as HTMLFormElement)
          .get('domain')
          ?.toString() || '';

      const parsed = parseSearchInput(domain);

      switch (parsed.type) {
        case 'ip':
          setInvalid(false);
          setIpDetailsOpen(true);
          return;
        case 'domain':
          setInvalid(false);
          redirectUser(parsed.value);
          plausible('Search Form: Submit', {
            props: { domain: parsed.value },
          });
          return;
        case 'invalid':
          setInvalid(true);
          return;
      }
    },
    [setInvalid, setIpDetailsOpen, redirectUser, plausible],
  );

  const { suggestions } = useSuggestions(domain);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null,
  );
  useEffect(() => {
    setSelectedSuggestion(null);
  }, [suggestions]);

  const handleSelectSuggestion = useCallback(
    (value: string) => {
      setInvalid(false);

      setDomain(value);
      setSuggestionsVisible(false);
      redirectUser(value);

      plausible('Search Form: Click Suggestion', {
        props: {
          domain: value,
          isExample: !domain,
        },
      });
    },
    [domain, setDomain, redirectUser, plausible],
  );

  const handleInput = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => setDomain(event.currentTarget.value),
    [setDomain],
  );

  const handleKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
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
            if (prev === suggestions?.length - 1) return 0;
            return prev + 1;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedSuggestion((prev) => {
            if (prev === null) return suggestions?.length - 1;
            if (prev === 0) return suggestions?.length - 1;
            return prev - 1;
          });
          break;
        case 'Enter':
          if (selectedSuggestion !== null) {
            event.preventDefault();
            handleSelectSuggestion(suggestions[selectedSuggestion]);
          }
          break;
        case 'Escape':
          setSuggestionsVisible(false);
          break;
      }
    },
    [
      suggestionsVisible,
      suggestions,
      selectedSuggestion,
      handleSelectSuggestion,
    ],
  );

  const handleFocus = useCallback(() => {
    // Skip the first render to avoid suggestions showing up on initial load without user interaction
    if (isFirstRender.current) return;
    setSuggestionsVisible(true);
  }, [isFirstRender, setSuggestionsVisible]);

  const handleIpDetailsOpenChange = useCallback(
    (open: boolean) => {
      setIpDetailsOpen(open);
      if (!open) {
        inputRef.current?.focus();
      }
    },
    [setIpDetailsOpen, inputRef],
  );

  return (
    <>
      <form ref={measureRef} className="relative" onSubmit={handleSubmit}>
        {domain === initialValue ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(initialValue)}`}
            alt=""
          />
        ) : (
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        )}

        <Input
          ref={inputRef}
          name="domain"
          className={cn('w-full !pl-9', {
            'focus-visible:ring-destructive [&:not(:focus-visible)]:border-destructive':
              isInvalid,
          })}
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
          value={domain}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onClick={handleFocus}
          onBlur={() => {
            setTimeout(() => {
              setSuggestionsVisible(false);
            }, 100);
          }}
          disabled={state !== FormStates.Initial}
          autoFocus={props.autofocus}
        />

        <ClientOnly>
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 font-mono text-[10px] font-medium opacity-100 dark:border-zinc-700 dark:bg-zinc-800 sm:flex">
            {isAppleDevice() ? (
              <>
                <span className="text-xs">⌘</span>K
              </>
            ) : (
              'ctrl+k'
            )}
          </kbd>
        </ClientOnly>

        {suggestionsVisible && suggestions && suggestions.length > 0 && (
          <Card className="absolute left-0 top-full z-10 h-min p-1">
            <ul>
              {suggestions.map((value, index) => (
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
                    className="mr-2 inline-block h-4 w-4"
                    src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(value)}`}
                    alt=""
                  />
                  {value}
                </li>
              ))}
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
