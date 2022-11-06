import { useRouter } from 'next/router';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import {
  Container,
  Heading,
  Link,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';

import CertInfo from '@/components/CertInfo';
import DnsLookup, { ResolvedRecords } from '@/utils/DnsLookup';
import DnsTable from '@/components/DnsTable';
import RelatedDomains from '@/components/RelatedDomains';
import SearchForm from '@/components/SearchForm';
import WhoisInfo from '@/components/WhoisInfo';

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

  if (!records) {
    return (
      <Container maxW="container.xl">
        <Heading as="h1" mb={2}>
          Results for{' '}
          <Link href={`https://${router.query.domain}`} isExternal>
            {router.query.domain} <ExternalLinkIcon mx="2px" />
          </Link>
        </Heading>
        <p>Failed loading</p>
      </Container>
    );
  }

  return (
    <>
      <Head>
        <title>{`Results for ${router.query.domain} - Domain Digger`}</title>
      </Head>

      <Container maxW="container.sm" mb={8}>
        <SearchForm initialValue={router.query.domain as string} />
      </Container>

      <Container maxW="container.xl">
        <Heading as="h1" mb={2}>
          Results for{' '}
          <Link href={`https://${router.query.domain}`} isExternal>
            {router.query.domain} <ExternalLinkIcon mx="2px" />
          </Link>
        </Heading>

        <RelatedDomains domain={router.query.domain as string} />

        <Tabs isLazy mt={6}>
          <TabList>
            <Tab>DNS</Tab>
            <Tab>Whois</Tab>
            <Tab>Certs</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              {Object.values(records)
                .map((r) => r.length)
                .reduce((prev, curr) => prev + curr, 0) === 0 ? (
                <Text textAlign="center" color="gray.500" mt={8}>
                  No DNS records found!
                </Text>
              ) : (
                <DnsTable records={records} />
              )}
            </TabPanel>

            <TabPanel>
              <WhoisInfo domain={router.query.domain as string} />
            </TabPanel>

            <TabPanel>
              <CertInfo domain={router.query.domain as string} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Container>
    </>
  );
};

export default LookupDomain;
