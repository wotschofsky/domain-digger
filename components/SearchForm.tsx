import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Stack, FormControl, Input, Button, Text } from '@chakra-ui/react';
import { toASCII } from 'punycode';
import { useRouter } from 'next/router';
import isFQDN from 'validator/lib/isFQDN';

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

    if (!isFQDN(normalizedDomain)) {
      setError(true);
      setState(FormStates.Initial);
      return;
    }

    router.push(`/lookup/${normalizedDomain}`);
  };

  useEffect(() => {
    const resetForm = () => setState(FormStates.Initial);

    router.events.on('routeChangeComplete', resetForm);
    router.events.on('routeChangeError', resetForm);

    return () => {
      router.events.off('routeChangeComplete', resetForm);
      router.events.off('routeChangeError', resetForm);
    };
  }, [router]);

  return (
    <>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        as="form"
        spacing="12px"
        onSubmit={handleSubmit}
      >
        <FormControl>
          <Input
            borderWidth={1}
            id="email"
            type="text"
            required
            placeholder="example.com"
            aria-label="Domain"
            value={domain}
            disabled={state !== FormStates.Initial}
            onInput={(event: ChangeEvent<HTMLInputElement>) =>
              setDomain(event.target.value)
            }
          />
        </FormControl>
        <FormControl w={{ base: '100%', md: '40%' }}>
          <Button
            colorScheme="blue"
            isLoading={state === FormStates.Submitting}
            w="100%"
            type="submit"
          >
            Lookup
          </Button>
        </FormControl>
      </Stack>

      <Text mt={2} textAlign="center" color={error ? 'red.500' : 'gray.500'}>
        {error
          ? 'An error occured! Please check your input or try again later.'
          : 'It can be anything! An apex or subdomain.'}
      </Text>
    </>
  );
};

export default SearchForm;
