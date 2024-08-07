'use client';

import { Loader2Icon, SearchIcon } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { usePathname, useRouter } from 'next/navigation';
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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ClientOnly } from '@/components/client-only';
import { EXAMPLE_DOMAINS } from '@/lib/data';
import { cn, isAppleDevice, isValidDomain } from '@/lib/utils';

const normalizeDomain = (input: string) => {
  let tDomain;
  try {
    tDomain = new URL(input.trim().toLowerCase()).hostname;
  } catch (err) {
    tDomain = input.trim().toLowerCase();
  }

  let normalizedDomain = tDomain.endsWith('.') ? tDomain.slice(0, -1) : tDomain;
  return toASCII(normalizedDomain);
};

const useSuggestions = (domain: string) => {
  return {
    suggestions: domain ? [] : EXAMPLE_DOMAINS,
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
  initialValue?: string;
  autofocus?: boolean;
};

export const SearchForm: FC<SearchFormProps> = (props) => {
  const isFirstRender = useFirstRender();

  const plausible = usePlausible();

  const router = useRouter();
  const pathname = usePathname();

  const [domain, setDomain] = useState(props.initialValue ?? '');
  const [state, setState] = useState<FormStates>(FormStates.Initial);
  const [error, setError] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  useHotkeys(
    isAppleDevice() ? 'meta+k' : 'ctrl+k',
    () => {
      setDomain('');
      inputRef.current?.focus();
    },
    { preventDefault: true },
    [inputRef.current]
  );

  const redirectUser = useCallback(
    (domain: string) => {
      setState(FormStates.Submitting);

      const target = `/lookup/${domain}`;

      if (pathname === target) {
        router.refresh();
        setTimeout(() => {
          setState(FormStates.Initial);
        }, 150);
        return;
      }

      router.push(target);
    },
    [setState, router, pathname]
  );

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const normalizedDomain = normalizeDomain(domain);
      if (!isValidDomain(normalizedDomain)) {
        setError(true);
        return;
      }

      setError(false);
      redirectUser(normalizedDomain);

      plausible('Search Form: Submit', {
        props: { domain: normalizedDomain },
      });
    },
    [setError, domain, redirectUser, plausible]
  );

  const { suggestions } = useSuggestions(domain);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null
  );
  useEffect(() => {
    setSelectedSuggestion(null);
  }, [suggestions]);

  const handleSelectSuggestion = useCallback(
    (value: string) => {
      setError(false);

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
    [domain, setDomain, redirectUser, plausible]
  );

  const handleInput = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (event) => setDomain(event.currentTarget.value),
    [setDomain]
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
    ]
  );

  const handleFocus = useCallback(() => {
    // Skip the first render to avoid suggestions showing up on initial load without user interaction
    if (isFirstRender.current) return;
    setSuggestionsVisible(true);
  }, [isFirstRender, setSuggestionsVisible]);

  return (
    <div>
      <form className="flex gap-3" onSubmit={handleSubmit}>
        <div className="group relative flex-[3]">
          {domain === props.initialValue ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(props.initialValue)}`}
              alt=""
            />
          ) : (
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}

          <Input
            ref={inputRef}
            className="w-full pl-9"
            type="text"
            required
            placeholder="Search any domain or URL"
            aria-label="Domain"
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
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
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
            <ul className="absolute left-0 top-full w-full rounded-xl border bg-card p-1 text-card-foreground shadow">
              {suggestions.map((value, index) => (
                <li
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center rounded-lg px-2 py-1 text-sm hover:bg-muted/50',
                    { 'bg-muted/50': selectedSuggestion === index }
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
          )}
        </div>
        <Button
          className="flex-[1]"
          type="submit"
          disabled={state !== FormStates.Initial}
        >
          {state === FormStates.Submitting && (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          )}
          Lookup
        </Button>
      </form>

      <p className="mt-2 whitespace-pre text-center text-sm text-red-600">
        {error
          ? 'An error occurred! Please check your input or try again later.'
          : ' '}
      </p>
    </div>
  );
};
