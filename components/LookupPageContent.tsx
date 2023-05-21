'use client';

import { ExternalLinkIcon } from 'lucide-react';
import type { FC } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import CertInfo from '@/components/CertInfo';
import DnsTable from '@/components/DnsTable';
import RelatedDomains from '@/components/RelatedDomains';
import SearchForm from '@/components/SearchForm';
import WhoisInfo from '@/components/WhoisInfo';
import type { ResolvedRecords } from '@/utils/DnsLookup';

type LookupPageContentProps = {
  domain: string;
  records: ResolvedRecords;
};

const LookupPageContent: FC<LookupPageContentProps> = ({ domain, records }) => (
  <>
    <div className="container mb-8 max-w-xl">
      <SearchForm initialValue={domain} />
    </div>

    <div className="container">
      <h1 className="mb-2 text-4xl font-bold">
        Results for{' '}
        <a href={`https://${domain}`} target="_blank">
          {domain} <ExternalLinkIcon className="inline-block" />
        </a>
      </h1>

      <RelatedDomains domain={domain} />

      <Tabs defaultValue="dns" className="mt-6">
        <TabsList>
          <TabsTrigger value="dns">DNS</TabsTrigger>
          <TabsTrigger value="whois">Whois</TabsTrigger>
          <TabsTrigger value="certs">Certs</TabsTrigger>
        </TabsList>

        <TabsContent value="dns">
          {Object.values(records)
            .map((r) => r.length)
            .reduce((prev, curr) => prev + curr, 0) === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              No DNS records found!
            </p>
          ) : (
            <DnsTable records={records} />
          )}
        </TabsContent>

        <TabsContent value="whois">
          <WhoisInfo domain={domain} />
        </TabsContent>

        <TabsContent value="certs">
          <CertInfo domain={domain} />
        </TabsContent>
      </Tabs>
    </div>
  </>
);

export default LookupPageContent;
