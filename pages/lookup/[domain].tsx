import { useRouter } from 'next/router';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import {
  Container,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from '@chakra-ui/react';

import CertInfo from '@/components/CertInfo';
import DnsLookup, { ResolvedRecords } from '@/utils/DnsLookup';
import DnsTable from '@/components/DnsTable';
import InvertedWWWLink from '@/components/InvertedWWWLink';
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
        <SearchForm initialValue={router.query.domain as string} />
      </Container>

      <Container maxW="container.xl">
        <Heading as="h1" mb={2}>
          Results for {router.query.domain}
        </Heading>

        <InvertedWWWLink domain={router.query.domain as string} />

        <Tabs isLazy mt={6}>
          <TabList>
            <Tab>DNS</Tab>
            <Tab>Whois</Tab>
            <Tab>Certs</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <DnsTable records={records} />
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
