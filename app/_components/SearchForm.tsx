'use client';

import { useDebounce } from '@uidotdev/usehooks';
import { Loader2 } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { usePathname, useRouter } from 'next/navigation';
import { toASCII } from 'punycode';
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const debouncedDomain = useDebounce(domain, 200);

  const { data: suggestions } = useSWR<string[]>(
    domain
      ? `/api/search-suggestions?q=${encodeURIComponent(debouncedDomain)}`
      : null,
    { keepPreviousData: true }
  );

  return { suggestions };
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

const SearchForm = (props: SearchFormProps) => {
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
        props: { domain: value },
      });
    },
    [setDomain, redirectUser, plausible]
  );

  const handleKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (
        !(suggestionsVisible && domain && suggestions && suggestions.length > 0)
      ) {
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
      }
    },
    [
      suggestionsVisible,
      domain,
      suggestions,
      selectedSuggestion,
      handleSelectSuggestion,
    ]
  );

  return (
    <div>
      <form className="flex gap-3" onSubmit={handleSubmit}>
        <div className="group relative flex-[3]">
          <Input
            ref={inputRef}
            className="w-full"
            type="text"
            required
            placeholder="example.com"
            aria-label="Domain"
            value={domain}
            onInput={(event: ChangeEvent<HTMLInputElement>) =>
              setDomain(event.target.value)
            }
            onKeyDown={handleKeyDown}
            onFocus={() => setSuggestionsVisible(true)}
            onBlur={() => {
              setTimeout(() => {
                setSuggestionsVisible(false);
              }, 100);
            }}
            disabled={state !== FormStates.Initial}
            autoFocus={props.autofocus}
          />

          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            {isAppleDevice() ? (
              <>
                <span className="text-xs">⌘</span>K
              </>
            ) : (
              'ctrl+k'
            )}
          </kbd>

          {suggestionsVisible &&
            domain &&
            suggestions &&
            suggestions.length > 0 && (
              <ul className="absolute left-0 top-full w-full rounded-xl border bg-card p-1 text-card-foreground shadow">
                {suggestions.map((value, index) => (
                  <li
                    key={value}
                    className={cn(
                      'cursor-pointer rounded-lg px-2 py-1 hover:bg-muted/50',
                      { 'bg-muted/50': selectedSuggestion === index }
                    )}
                    onClick={() => handleSelectSuggestion(value)}
                  >
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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Lookup
        </Button>
      </form>

      {error ? (
        <p className="mt-2 text-center text-sm text-red-600">
          An error occurred! Please check your input or try again later.
        </p>
      ) : (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          It can be anything! An apex, subdomain, or even a URL.
        </p>
      )}
    </div>
  );
};

export default SearchForm;
