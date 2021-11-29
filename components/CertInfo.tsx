import {
  Flex,
  Spinner,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import useSWR from 'swr';

import type { CertLookupResponse } from '@/api/lookupCerts';

type CertInfoProps = {
  domain: string;
};

const CertInfo = ({ domain }: CertInfoProps) => {
  const { data, error } = useSWR<CertLookupResponse>(
    `/api/lookupCerts?domain=${encodeURIComponent(domain)}`
  );

  if (!data) {
    return (
      <Flex justify="center" align="center">
        <Spinner size="xl" my={8} />
      </Flex>
    );
  }

  if (error) {
    return <p>An error occurred!</p>;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th pl={0}>Logged At</Th>
          <Th>Not Before</Th>
          <Th>Not After</Th>
          <Th>Common Name</Th>
          <Th>Matching Identities</Th>
          <Th pr={0}>Issuer Name</Th>
        </Tr>
      </Thead>
      <Tbody>
        {data.certificates.map((cert) => (
          <Tr key={cert.id}>
            <Td pl={0}>{cert.loggedAt}</Td>
            <Td>{cert.notBefore}</Td>
            <Td>{cert.notAfter}</Td>
            <Td>{cert.commonName}</Td>
            <Td
              dangerouslySetInnerHTML={{
                __html: cert.matchingIdentities.replace(/\n/g, '<br>'),
              }}
            ></Td>
            <Td pr={0}>{cert.issuerName}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default CertInfo;
