import Head from 'next/head';
import { useColorModeValue, Heading, Container, Flex } from '@chakra-ui/react';

import SearchForm from '@/components/SearchForm';

// Based on simple newsletter template from https://chakra-templates.dev

const Home = () => {
  return (
    <>
      <Head>
        <title>Domain Digger</title>
      </Head>

      <Container
        maxW="lg"
        bg={useColorModeValue('white', 'whiteAlpha.100')}
        boxShadow="xl"
        rounded="lg"
        my={16}
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

        <SearchForm />
      </Container>
    </>
  );
};

export default Home;
