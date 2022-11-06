import Head from 'next/head';
import { Container, Heading, Text, useColorModeValue } from '@chakra-ui/react';

import BookmarkletLink from '@/components/BookmarkletLink';
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
        flexDirection="column"
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

      <Container
        maxW="lg"
        bg={useColorModeValue('white', 'whiteAlpha.100')}
        boxShadow="xl"
        rounded="lg"
        my={16}
        p={6}
        flexDirection="column"
      >
        <Heading
          as="h2"
          fontSize={{ base: 'xl', sm: '2xl' }}
          textAlign="center"
          mb={5}
        >
          Quickly inspect any Website
        </Heading>

        <Text mt={2} mb={5} textAlign="center" color={'gray.500'}>
          Drag this link to your bookmarks bar to quickly go to the results page
          for the site you are currently on!
        </Text>
        <BookmarkletLink />
      </Container>
    </>
  );
};

export default Home;
