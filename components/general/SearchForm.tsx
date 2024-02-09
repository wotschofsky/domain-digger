'use client';

import { Loader2 } from 'lucide-react';
import { usePlausible } from 'next-plausible';
import { usePathname, useRouter } from 'next/navigation';
import { toASCII } from 'punycode';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { cn, isAppleDevice, isValidDomain } from '@/lib/utils';

enum FormStates {
  Initial,
  Submitting,
  Success,
}

type SearchFormProps = {
  textAlignment: 'left' | 'center';
  initialValue?: string;
  autofocus?: boolean;
};

const SearchForm = (props: SearchFormProps) => {
  const plausible = usePlausible();

  const router = useRouter();
  const pathname = usePathname();

  const [domain, setDomain] = useState('');
  const [state, setState] = useState<FormStates>(FormStates.Initial);
  const [error, setError] = useState(false);

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

  useEffect(() => {
    if (props.initialValue) {
      setDomain(props.initialValue);
    }
  }, [props.initialValue]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(false);
    setState(FormStates.Submitting);

    let tDomain;
    try {
      tDomain = new URL(domain.trim().toLowerCase()).hostname;
    } catch (err) {
      tDomain = domain.trim().toLowerCase();
    }

    let normalizedDomain = tDomain.endsWith('.')
      ? tDomain.slice(0, -1)
      : tDomain;
    normalizedDomain = toASCII(normalizedDomain);

    if (!isValidDomain(normalizedDomain)) {
      setError(true);
      setState(FormStates.Initial);
      return;
    }

    const target = `/lookup/${normalizedDomain}`;

    if (pathname === target) {
      router.refresh();
      setTimeout(() => {
        setState(FormStates.Initial);
      }, 150);
      return;
    }

    router.push(target);

    plausible('Search Form: Submit', {
      props: { domain: normalizedDomain },
    });
  };

  return (
    <>
      <form className="flex gap-3" onSubmit={handleSubmit}>
        <div className="relative flex-[3]">
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
        <p
          className={cn('mt-2 text-sm text-red-600', {
            'text-center': props.textAlignment === 'center',
          })}
        >
          An error occurred! Please check your input or try again later.
        </p>
      ) : (
        <p
          className={cn('mt-2 text-sm text-muted-foreground', {
            'text-center': props.textAlignment === 'center',
          })}
        >
          It can be anything! An apex, subdomain, or even a URL.
        </p>
      )}
    </>
  );
};

export default SearchForm;
