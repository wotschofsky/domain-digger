'use client';

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
import DnsTable from '@/components/DnsTable';
import RelatedDomains from '@/components/RelatedDomains';
import SearchForm from '@/components/SearchForm';
import type { FC } from 'react';
import type { ResolvedRecords } from '@/utils/DnsLookup';
import WhoisInfo from '@/components/WhoisInfo';

type LookupPageContentProps = {
  domain: string;
  records: ResolvedRecords;
};

const LookupPageContent: FC<LookupPageContentProps> = ({ domain, records }) => (
  <>
    <Container maxW="container.sm" mb={8}>
      <SearchForm initialValue={domain as string} />
    </Container>

    <Container maxW="container.xl">
      <Heading as="h1" mb={2}>
        Results for{' '}
        <Link href={`https://${domain}`} isExternal>
          {domain} <ExternalLinkIcon mx="2px" />
        </Link>
      </Heading>

      <RelatedDomains domain={domain} />

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
            <WhoisInfo domain={domain as string} />
          </TabPanel>

          <TabPanel>
            <CertInfo domain={domain as string} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  </>
);

export default LookupPageContent;
