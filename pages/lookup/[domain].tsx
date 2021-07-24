import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Heading,
  Container,
} from '@chakra-ui/react';
import axios from 'axios';

type RecordTypes =
  | 'A'
  | 'AAAA'
  | 'CAA'
  | 'CNAME'
  | 'DNSKEY'
  | 'MX'
  | 'NAPTR'
  | 'NS'
  | 'PTR'
  | 'SOA'
  | 'SRV'
  | 'TXT';

type ResolvedRecords = {
  [name: string]: RawRecord[];
};

type RawRecord = {
  name: string;
  type: number;
  TTL: number;
  data: string;
};

const fetchRecords = async (
  domain: string,
  record: RecordTypes
): Promise<RawRecord[]> => {
  const url = `https://dns.google.com/resolve?name=${domain}&type=${record}`;

  const response = await axios.get(url);
  const records = response.data.Answer || [];

  return records;
};

const extractRecords = (
  records: PromiseSettledResult<RawRecord[]>
): RawRecord[] => {
  if (records.status === 'fulfilled') {
    return records.value;
  }
  return [];
};

// Filter records to prevent results from recursive CNAME lookups showing up
const filterRecords = (domain: string, records: RawRecord[]): RawRecord[] =>
  records.filter((record) => record.name.includes(domain));

type LookupDomainProps = {
  records?: ResolvedRecords;
};

export const getServerSideProps: GetServerSideProps<LookupDomainProps> = async (
  context
) => {
  const domain = context.query.domain as string;

  try {
    const results = await Promise.allSettled([
      fetchRecords(domain, 'A'),
      fetchRecords(domain, 'AAAA'),
      fetchRecords(domain, 'CAA'),
      fetchRecords(domain, 'CNAME'),
      fetchRecords(domain, 'DNSKEY'),
      fetchRecords(domain, 'MX'),
      fetchRecords(domain, 'NAPTR'),
      fetchRecords(domain, 'NS'),
      fetchRecords(domain, 'PTR'),
      fetchRecords(domain, 'SOA'),
      fetchRecords(domain, 'SRV'),
      fetchRecords(domain, 'TXT'),
    ]);

    const records: ResolvedRecords = {
      A: filterRecords(domain, extractRecords(results[0])),
      AAAA: filterRecords(domain, extractRecords(results[1])),
      CAA: filterRecords(domain, extractRecords(results[2])),
      CNAME: filterRecords(domain, extractRecords(results[3])),
      DNSKEY: filterRecords(domain, extractRecords(results[4])),
      MX: filterRecords(domain, extractRecords(results[5])),
      NAPTR: filterRecords(domain, extractRecords(results[6])),
      NS: filterRecords(domain, extractRecords(results[7])),
      PTR: filterRecords(domain, extractRecords(results[8])),
      SOA: filterRecords(domain, extractRecords(results[9])),
      SRV: filterRecords(domain, extractRecords(results[10])),
      TXT: filterRecords(domain, extractRecords(results[11])),
    };

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

const CustomRow = ({ record }: { record: RawRecord }) => (
  <Tr>
    <Td>{record.name}</Td>
    <Td>{record.TTL}</Td>
    <Td>{record.data}</Td>
  </Tr>
);

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

      <Container maxW="container.xl">
        <Heading as="h1" mb={5}>
          Results for {router.query.domain}
        </Heading>

        {Object.keys(records).map((recordType) => {
          const value = records[recordType];

          if (!value || value.length === 0) {
            return;
          }

          return (
            <>
              <Heading
                as="h2"
                fontSize={{ base: 'xl', sm: '2xl' }}
                mb={4}
                mt={8}
                ml={5}
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
                    <CustomRow key={JSON.stringify(v)} record={v} />
                  ))}
                </Tbody>
              </Table>
            </>
          );
        })}
      </Container>
    </>
  );
};

export default LookupDomain;
