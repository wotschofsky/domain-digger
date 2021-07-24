import Head from 'next/head';
import { FormEvent, ChangeEvent, useState } from 'react';
import {
  Stack,
  FormControl,
  Input,
  Button,
  useColorModeValue,
  Heading,
  Text,
  Container,
  Flex,
} from '@chakra-ui/react';
import { useRouter } from 'next/router';

enum FormStates {
  Initial,
  Submitting,
  Success,
}

const domainRegex = new RegExp(
  /^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/
);

// Based on simple newsletter template from https://chakra-templates.dev

const Home = () => {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [state, setState] = useState<FormStates>(FormStates.Initial);
  const [error, setError] = useState(false);

  return (
    <>
      <Head>
        <title>Domain Digger</title>
      </Head>

      <Flex
        minH="100vh"
        align="center"
        justify="center"
        bg={useColorModeValue('gray.50', 'gray.800')}
      >
        <Container
          maxW="lg"
          bg={useColorModeValue('white', 'whiteAlpha.100')}
          boxShadow="xl"
          rounded="lg"
          p={6}
          direction="column"
        >
          <Heading
            as="h2"
            fontSize={{ base: 'xl', sm: '2xl' }}
            textAlign="center"
            mb={5}
          >
            Get details about any Domain
          </Heading>
          <Stack
            direction={{ base: 'column', md: 'row' }}
            as="form"
            spacing="12px"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setError(false);
              setState(FormStates.Submitting);

              if (!domain.match(domainRegex)) {
                setError(true);
                setState(FormStates.Initial);
                return;
              }

              router.push(`/lookup/${domain}`);
            }}
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
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

          <Text
            mt={2}
            textAlign="center"
            color={error ? 'red.500' : 'gray.500'}
          >
            {error
              ? 'An error occured! Please check your input or try again later.'
              : 'It can be anything! An apex or subdomain.'}
          </Text>
        </Container>
      </Flex>
    </>
  );
};

export default Home;
