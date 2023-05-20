'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toASCII } from 'punycode';
import { useRouter } from 'next/navigation';
import isValidDomain from 'is-valid-domain';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

enum FormStates {
  Initial,
  Submitting,
  Success,
}

type SearchFormProps = {
  initialValue?: string;
};

const SearchForm = (props: SearchFormProps) => {
  const router = useRouter();

  const [domain, setDomain] = useState('');
  const [state, setState] = useState<FormStates>(FormStates.Initial);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (props.initialValue) {
      setDomain(props.initialValue);
    }
  }, [props.initialValue]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(false);
    setState(FormStates.Submitting);

    const normalizedDomain = toASCII(domain.trim().toLowerCase());

    if (!isValidDomain(normalizedDomain)) {
      setError(true);
      setState(FormStates.Initial);
      return;
    }

    router.push(`/lookup/${normalizedDomain}`);
  };

  return (
    <>
      <form className="flex gap-3" onSubmit={handleSubmit}>
        <Input
          style={{
            flex: 3,
          }}
          type="text"
          required
          placeholder="example.com"
          aria-label="Domain"
          value={domain}
          onInput={(event: ChangeEvent<HTMLInputElement>) =>
            setDomain(event.target.value)
          }
          disabled={state !== FormStates.Initial}
        />
        <Button
          style={{
            flex: 1,
          }}
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
        <p className="text-sm text-center text-red-600 mt-2">
          An error occured! Please check your input or try again later.
        </p>
      ) : (
        <p className="text-sm text-center text-muted-foreground mt-2">
          It can be anything! An apex or subdomain.
        </p>
      )}
    </>
  );
};

export default SearchForm;
