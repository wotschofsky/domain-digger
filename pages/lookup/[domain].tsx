import { Fragment } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import {
  Button,
  Container,
  Heading,
  HStack,
  Table,
  Tbody,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from '@chakra-ui/react';

import DnsLookup, { ResolvedRecords } from '@/utils/DnsLookup';
import RecordRow from '@/components/RecordRow';
import SearchForm from '@/components/SearchForm';
import WhoisModal from '@/components/WhoisModal';

type LookupDomainProps = {
  records?: ResolvedRecords;
};

export const getServerSideProps: GetServerSideProps<LookupDomainProps> = async (
  context
) => {
  const domain = context.query.domain as string;

  try {
    const records = await DnsLookup.resolveAllRecords(domain);

    return {
      props: { records: records, error: false },
    };
  } catch (error) {
    console.error(error);
  }

  return {
    props: {
      error: true,
    },
  };
};

const LookupDomain = ({
  records,
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const router = useRouter();

  const { isOpen, onOpen, onClose } = useDisclosure();

  if (!records) {
    return (
      <Container maxW="container.xl">
        <Heading as="h1" mb={5}>
          Results for {router.query.domain}
        </Heading>
        <p>Failed loading</p>
      </Container>
    );
  }

  return (
    <>
      <Head>
        <title>Results for {router.query.domain} - Domain Digger</title>
      </Head>

      <Container maxW="container.sm" mb={8}>
        <SearchForm />
      </Container>

      <Container maxW="container.xl">
        <HStack align="center" mb={4}>
          <Heading as="h1">
            Results for {router.query.domain}
          </Heading>
          <Button variant="ghost" onClick={onOpen}>
            Show Whois
          </Button>
        </HStack>

        <WhoisModal
          domain={router.query.domain as string}
          isOpen={isOpen}
          onClose={onClose}
        />

        {Object.keys(records).map((recordType) => {
          const value = records[recordType];

          if (!value || value.length === 0) {
            return;
          }

          return (
            <Fragment key={recordType}>
              <Heading
                as="h2"
                fontSize={{ base: 'xl', sm: '2xl' }}
                mb={4}
                mt={8}
                ml={6}
              >
                {recordType}
              </Heading>
              <Table key={recordType}>
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>TTL</Th>
                    <Th>Value</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {value.map((v) => (
                    <RecordRow key={v.type + v.data} record={v} />
                  ))}
                </Tbody>
              </Table>
            </Fragment>
          );
        })}
      </Container>
    </>
  );
};

export default LookupDomain;
